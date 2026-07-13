import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const appIndexPath = join(rootDir, "dist", "app", "index.html");

if (!existsSync(appIndexPath)) {
  throw new Error("Missing dist/app/index.html. Run the app build before preparing Pages output.");
}

writeFileSync(
  join(rootDir, "dist", "app", "_redirects"),
  [
    "/workspace/* /index.html 200",
    "/applications/* /index.html 200",
    "/dashboard /index.html 200",
    "/resumes /index.html 200",
    "/settings /index.html 200",
    "/optimizer /workspace/optimize 301",
    "/* /index.html 200",
    "",
  ].join("\n"),
);
