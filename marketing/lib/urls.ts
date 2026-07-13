const localAppOrigin = "http://localhost:5173";

export const APP_WORKSPACE_URL = import.meta.env.DEV
  ? `${localAppOrigin}/workspace/optimize`
  : "/app/workspace/optimize";
