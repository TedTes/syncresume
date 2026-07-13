const required = {
  VITE_CLOUDFLARE_API_URL: process.env.VITE_CLOUDFLARE_API_URL,
  VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY,
};

const errors = [];

if (required.VITE_CLOUDFLARE_API_URL !== "https://api.syncresume.io") {
  errors.push("VITE_CLOUDFLARE_API_URL must be https://api.syncresume.io for app production deploys.");
}

if (!required.VITE_CLERK_PUBLISHABLE_KEY) {
  errors.push("VITE_CLERK_PUBLISHABLE_KEY must be set to the production Clerk publishable key.");
} else if (!required.VITE_CLERK_PUBLISHABLE_KEY.startsWith("pk_live_")) {
  errors.push("VITE_CLERK_PUBLISHABLE_KEY must be a production key that starts with pk_live_.");
}

if (errors.length > 0) {
  console.error("App production environment is not deployable:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}
