const localAppOrigin = "http://localhost:5173";

export const APP_WORKSPACE_URL = import.meta.env.DEV
  ? `${localAppOrigin}/workspace/optimize`
  : "https://app.syncresume.io/workspace/optimize";
