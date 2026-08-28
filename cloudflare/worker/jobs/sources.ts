import type {
  JobFeedInput,
  JobSourceConfig,
  JobSourceEnv,
  JobSourceError,
  JobSourceProvider,
  JobSourceResult,
  JobSourceSyncResult,
} from "./types";

type JsonRecord = Record<string, unknown>;

const MAX_SOURCE_JOBS = 20;
const MAX_DESCRIPTION_CHARS = 45_000;

type SourceAdapter = {
  provider: JobSourceProvider;
  fetchJobs(config: JobSourceConfig, env: JobSourceEnv): Promise<JobSourceResult>;
};

const adapters: Record<JobSourceProvider, SourceAdapter> = {
  greenhouse: {
    provider: "greenhouse",
    async fetchJobs(config) {
      const boardToken = cleanText(config.boardToken, 120);
      if (!boardToken) throw new Error("Greenhouse source requires boardToken.");

      const response = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`,
      );
      const body = asRecord(await readProviderJson(response, "Greenhouse"));
      const jobs = Array.isArray(body.jobs) ? body.jobs : [];

      return {
        source: sourceName(config, "greenhouse", boardToken),
        provider: "greenhouse",
        jobs: filterSourceJobs(
          jobs.map((job) => mapGreenhouseJob(job, config, boardToken)),
          config,
        ).slice(0, limitFor(config)),
      };
    },
  },
  lever: {
    provider: "lever",
    async fetchJobs(config) {
      const boardToken = cleanText(config.boardToken, 120);
      if (!boardToken) throw new Error("Lever source requires boardToken.");

      const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(boardToken)}?mode=json`);
      const body = await readProviderJson(response, "Lever");
      const jobs = Array.isArray(body) ? body : [];

      return {
        source: sourceName(config, "lever", boardToken),
        provider: "lever",
        jobs: filterSourceJobs(
          jobs.map((job) => mapLeverJob(job, config, boardToken)),
          config,
        ).slice(0, limitFor(config)),
      };
    },
  },
  ashby: {
    provider: "ashby",
    async fetchJobs(config) {
      const boardToken = cleanText(config.boardToken, 120);
      if (!boardToken) throw new Error("Ashby source requires boardToken.");

      const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardToken)}`);
      const body = asRecord(await readProviderJson(response, "Ashby"));
      const jobs = Array.isArray(body.jobs) ? body.jobs : [];

      return {
        source: sourceName(config, "ashby", boardToken),
        provider: "ashby",
        jobs: filterSourceJobs(
          jobs.map((job) => mapAshbyJob(job, config, boardToken)),
          config,
        ).slice(0, limitFor(config)),
      };
    },
  },
  apify: {
    provider: "apify",
    async fetchJobs(config, env) {
      const token = cleanText(env.APIFY_API_TOKEN, 400);
      if (!token) throw new Error("Apify source requires APIFY_API_TOKEN.");

      const actorTaskId = cleanText(config.actorTaskId, 180);
      const actorId = cleanText(config.actorId, 180);
      const input = config.input && typeof config.input === "object" ? config.input : {};
      const target = actorTaskId
        ? `actor-tasks/${encodeURIComponent(actorTaskId)}`
        : actorId
          ? `acts/${encodeURIComponent(actorId)}`
          : "";

      if (!target) throw new Error("Apify source requires actorTaskId or actorId.");

      const response = await fetch(
        `https://api.apify.com/v2/${target}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const body = await readProviderJson(response, "Apify");
      const rows = Array.isArray(body) ? body : [];

      return {
        source: sourceName(config, "apify", actorTaskId || actorId),
        provider: "apify",
        jobs: filterSourceJobs(
          rows.map((row) => mapGenericJob(row, config)),
          config,
        ).slice(0, limitFor(config)),
      };
    },
  },
};

export function parseJobSourceConfigs(input: unknown, env: JobSourceEnv): JobSourceConfig[] {
  const explicit = normalizeSourceConfigList(input);
  if (explicit.length > 0) return explicit;

  const configured = cleanText(env.JOB_SOURCE_CONFIG, 100_000);
  if (!configured) return [];

  try {
    return normalizeSourceConfigList(JSON.parse(configured));
  } catch {
    return [];
  }
}

export async function fetchJobsFromSources(configs: JobSourceConfig[], env: JobSourceEnv): Promise<JobSourceSyncResult> {
  const results: JobSourceResult[] = [];
  const errors: JobSourceError[] = [];

  for (const config of configs) {
    if (config.enabled === false) continue;

    const adapter = adapters[config.provider];
    if (!adapter) {
      errors.push({
        source: config.source || config.provider || "unknown",
        provider: config.provider,
        message: "Unsupported job source provider.",
      });
      continue;
    }

    try {
      const result = await adapter.fetchJobs(config, env);
      results.push({
        ...result,
        jobs: result.jobs.filter((job) => job.title && (job.url || job.description)),
      });
    } catch (error) {
      errors.push({
        source: config.source || config.provider,
        provider: config.provider,
        message: error instanceof Error ? error.message : "Job source failed.",
      });
    }
  }

  return { results, errors };
}

function normalizeSourceConfigList(input: unknown): JobSourceConfig[] {
  const rawSources: unknown[] = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as JsonRecord).sources)
      ? ((input as JsonRecord).sources as unknown[])
      : [];

  const configs: JobSourceConfig[] = [];

  for (const rawSource of rawSources) {
    const value = rawSource && typeof rawSource === "object" && !Array.isArray(rawSource)
      ? rawSource as JsonRecord
      : null;
    if (!value) continue;

    const provider = cleanText(value.provider, 40).toLowerCase();
    if (!isJobSourceProvider(provider)) continue;

    configs.push({
      provider,
      enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
      limit: typeof value.limit === "number" ? value.limit : undefined,
      source: cleanText(value.source, 80),
      boardToken: cleanText(value.boardToken, 120),
      company: cleanText(value.company, 160),
      query: cleanText(value.query, 200),
      location: cleanText(value.location, 160),
      actorId: cleanText(value.actorId, 180),
      actorTaskId: cleanText(value.actorTaskId, 180),
      input: value.input && typeof value.input === "object" && !Array.isArray(value.input)
        ? value.input as Record<string, unknown>
        : undefined,
      resultMapping: value.resultMapping && typeof value.resultMapping === "object" && !Array.isArray(value.resultMapping)
        ? value.resultMapping as Record<string, string>
        : undefined,
    });
  }

  return configs;
}

function isJobSourceProvider(value: string): value is JobSourceProvider {
  return value === "greenhouse" || value === "lever" || value === "ashby" || value === "apify";
}

async function readProviderJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`${label} returned ${response.status}${message ? `: ${message.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

function mapGreenhouseJob(value: unknown, config: JobSourceConfig, boardToken: string): JobFeedInput {
  const job = asRecord(value);
  const location = asRecord(job.location);
  const absoluteUrl = cleanText(job.absolute_url, 1_000);

  return {
    source: sourceName(config, "greenhouse", boardToken),
    externalId: stringifyId(job.id),
    title: cleanText(job.title, 180),
    company: cleanText(config.company, 160) || boardToken,
    location: cleanText(location.name, 160),
    url: absoluteUrl,
    description: cleanDescription(job.content),
    status: "new",
    postedAt: cleanText(job.updated_at, 80) || null,
  };
}

function mapLeverJob(value: unknown, config: JobSourceConfig, boardToken: string): JobFeedInput {
  const job = asRecord(value);
  const categories = asRecord(job.categories);
  const lists = Array.isArray(job.lists) ? job.lists : [];
  const description = [
    cleanText(job.descriptionPlain, MAX_DESCRIPTION_CHARS),
    ...lists.map((list) => {
      const item = asRecord(list);
      const text = Array.isArray(item.content) ? item.content.join("\n") : item.content;
      return [cleanText(item.text, 200), cleanText(text, MAX_DESCRIPTION_CHARS)].filter(Boolean).join("\n");
    }),
  ].filter(Boolean).join("\n\n");

  return {
    source: sourceName(config, "lever", boardToken),
    externalId: stringifyId(job.id),
    title: cleanText(job.text, 180),
    company: cleanText(config.company, 160) || boardToken,
    location: cleanText(categories.location, 160),
    url: cleanText(job.hostedUrl, 1_000) || cleanText(job.applyUrl, 1_000),
    description: cleanDescription(description),
    employmentType: cleanText(categories.commitment, 80),
    remote: cleanText(categories.location, 160).toLowerCase().includes("remote") ? "remote" : "",
    status: "new",
    postedAt: typeof job.createdAt === "number" ? new Date(job.createdAt).toISOString() : null,
  };
}

function mapAshbyJob(value: unknown, config: JobSourceConfig, boardToken: string): JobFeedInput {
  const job = asRecord(value);
  const location = asRecord(job.location);

  return {
    source: sourceName(config, "ashby", boardToken),
    externalId: stringifyId(job.id),
    title: cleanText(job.title, 180),
    company: cleanText(config.company, 160) || boardToken,
    location: cleanText(location.name, 160),
    url: cleanText(job.jobUrl, 1_000) || cleanText(job.applyUrl, 1_000),
    description: cleanDescription(job.descriptionPlain || job.descriptionHtml || job.description),
    employmentType: cleanText(job.employmentType, 80),
    status: "new",
    postedAt: cleanText(job.publishedAt, 80) || null,
  };
}

function mapGenericJob(value: unknown, config: JobSourceConfig): JobFeedInput {
  const job = asRecord(value);
  const mapping = config.resultMapping ?? {};
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const mapped = mapping[key] || key;
      const value = readPath(job, mapped);
      const text = cleanText(value, key === "description" ? MAX_DESCRIPTION_CHARS : 1_000);
      if (text) return text;
    }
    return "";
  };

  return {
    source: sourceName(config, "apify", config.actorTaskId || config.actorId || "job-source"),
    externalId: pick("externalId", "id", "jobId"),
    title: pick("title", "positionName", "jobTitle"),
    company: pick("company", "companyName", "hiringOrganization.name"),
    location: pick("location", "jobLocation", "address"),
    url: pick("url", "jobUrl", "applyUrl", "link"),
    description: cleanDescription(pick("description", "jobDescription", "text", "details")),
    salary: pick("salary", "salaryText", "compensation"),
    employmentType: pick("employmentType", "employment_type", "jobType"),
    remote: pick("remote", "workplaceType", "workplace"),
    status: "new",
    postedAt: pick("postedAt", "posted_at", "datePosted", "publishedAt") || null,
  };
}

function sourceName(config: JobSourceConfig, provider: string, fallback: string): string {
  return cleanText(config.source, 80) || `${provider}:${fallback}`;
}

function limitFor(config: JobSourceConfig): number {
  if (!Number.isFinite(config.limit)) return MAX_SOURCE_JOBS;
  return Math.min(MAX_SOURCE_JOBS, Math.max(1, Math.round(config.limit ?? MAX_SOURCE_JOBS)));
}

function filterSourceJobs(jobs: JobFeedInput[], config: JobSourceConfig): JobFeedInput[] {
  const query = cleanText(config.query, 200).toLowerCase();
  const location = cleanText(config.location, 160).toLowerCase();

  return jobs.filter((job) => {
    const searchable = [
      job.title,
      job.company,
      job.location,
      job.description,
      job.employmentType,
      job.remote,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const locationText = [job.location, job.remote].filter(Boolean).join(" ").toLowerCase();

    return (!query || searchable.includes(query)) && (!location || locationText.includes(location));
  });
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringifyId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readPath(value: JsonRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as JsonRecord)[part];
  }, value);
}

function cleanDescription(value: unknown): string {
  return cleanText(value, MAX_DESCRIPTION_CHARS)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}
