import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

function buildNodePath(workerPath) {
  const parts = [];
  if (process.env.NODE_PATH) parts.push(process.env.NODE_PATH);

  // Packaged Electron: modules live under resources/app.asar(.unpacked)/node_modules
  if (process.resourcesPath) {
    parts.push(path.join(process.resourcesPath, "app.asar.unpacked", "node_modules"));
    parts.push(path.join(process.resourcesPath, "app", "node_modules"));
  }

  // Dev / nearby resolution from worker file
  const workerDir = path.dirname(workerPath);
  parts.push(path.join(workerDir, "node_modules"));
  parts.push(path.join(process.cwd(), "node_modules"));

  // Walk up a few levels from worker for monorepo/dev layouts
  let cursor = workerDir;
  for (let i = 0; i < 5; i += 1) {
    const candidate = path.join(cursor, "node_modules");
    if (fs.existsSync(candidate)) parts.push(candidate);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return [...new Set(parts)].join(path.delimiter);
}

/**
 * Runs PDF/Excel parsing in a separate Node process so xlsx/pdf-parse
 * are never bundled into the Electron main vite chunk.
 */
export function parseBinarySupplierFile(filePath, ext, workerPath) {
  return new Promise((resolve, reject) => {
    const child = fork(workerPath, [filePath, ext], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_PATH: buildNodePath(workerPath),
      },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    let stderr = "";
    let settled = false;

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("message", (message) => {
      if (settled) return;
      settled = true;
      if (message?.ok) resolve(message.items || []);
      else reject(new Error(message?.error || stderr || "Worker failed to parse file"));
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      reject(new Error(stderr || `Parser worker exited with code ${code}`));
    });
  });
}
