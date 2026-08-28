import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const outputZip = resolve(root, "syncresume-extension.zip");

await run("node", ["scripts/build-extension.mjs"], root);
await rm(outputZip, { force: true });
await run("zip", ["-qr", outputZip, "."], resolve(root, "dist-extension"));

console.log(`Packaged extension at ${outputZip}`);

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
