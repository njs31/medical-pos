import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

function resolveSupplierNodeModules(workerPath) {
  const candidates = [];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "app.asar.unpacked", "node_modules"));
    candidates.push(path.join(process.resourcesPath, "app", "node_modules"));
  }

  const workerDir = path.dirname(workerPath);
  let cursor = workerDir;
  for (let i = 0; i < 6; i += 1) {
    candidates.push(path.join(cursor, "node_modules"));
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  candidates.push(path.join(process.cwd(), "node_modules"));

  for (const candidate of [...new Set(candidates)]) {
    if (
      fs.existsSync(path.join(candidate, "pdf-parse", "package.json")) ||
      fs.existsSync(path.join(candidate, "xlsx", "package.json"))
    ) {
      return candidate;
    }
  }

  return "";
}

/**
 * Runs PDF/Excel parsing in a separate Node process so xlsx/pdf-parse
 * are never bundled into the Electron main vite chunk.
 *
 * Uses ELECTRON_RUN_AS_NODE (plain Node), which cannot read asar — so
 * pdf-parse/xlsx/pdfjs must be asar-unpacked and passed via SUPPLIER_IMPORT_NODE_MODULES.
 */
export function parseBinarySupplierFile(filePath, ext, workerPath) {
  return new Promise((resolve, reject) => {
    const nodeModules = resolveSupplierNodeModules(workerPath);
    const child = fork(workerPath, [filePath, ext], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        SUPPLIER_IMPORT_NODE_MODULES: nodeModules,
        NODE_PATH: [nodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
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
