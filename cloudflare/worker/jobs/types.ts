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

export type JobSourceProvider = "custom" | "greenhouse" | "lever" | "ashby" | "apify";

export type JobSyncCriteria = {
  targetTitles?: string[];
  location?: "any" | "remote-canada" | "remote-us";
  workType?: "any" | "remote" | "remote-hybrid";
  seniority?: "any" | "mid-senior" | "senior-staff";
  salaryFloor?: "none" | "140k" | "160k";
  sponsorship?: "any" | "not-needed" | "needed";
  dailyLimit?: number;
};

export type JobSourceConfig = {
  provider: JobSourceProvider;
  enabled?: boolean;
  limit?: number;
  source?: string;
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  queryParams?: Record<string, unknown>;
  body?: Record<string, unknown>;
  itemsPath?: string;
  boardToken?: string;
  company?: string;
  query?: string;
  location?: string;
  actorId?: string;
  actorTaskId?: string;
  input?: Record<string, unknown>;
  resultMapping?: Record<string, string>;
  criteria?: JobSyncCriteria;
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
  JOB_SEARCH_API_KEY?: string;
  JOB_SOURCE_CONFIG?: string;
};
