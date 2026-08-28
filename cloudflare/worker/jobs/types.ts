export type JobFeedStatus = "new" | "saved" | "dismissed" | "applied";

export type JobFeedInput = {
  source?: string;
  externalId?: string | null;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  description?: string;
  salary?: string;
  employmentType?: string;
  remote?: string;
  status?: JobFeedStatus;
  postedAt?: string | null;
};

export type JobSourceProvider = "greenhouse" | "lever" | "ashby" | "apify";

export type JobSourceConfig = {
  provider: JobSourceProvider;
  enabled?: boolean;
  limit?: number;
  source?: string;
  boardToken?: string;
  company?: string;
  query?: string;
  location?: string;
  actorId?: string;
  actorTaskId?: string;
  input?: Record<string, unknown>;
  resultMapping?: Record<string, string>;
};

export type JobSourceResult = {
  source: string;
  provider: JobSourceProvider;
  jobs: JobFeedInput[];
};

export type JobSourceError = {
  source: string;
  provider: JobSourceProvider;
  message: string;
};

export type JobSourceSyncResult = {
  results: JobSourceResult[];
  errors: JobSourceError[];
};

export type JobSourceEnv = {
  APIFY_API_TOKEN?: string;
  JOB_SOURCE_CONFIG?: string;
};
