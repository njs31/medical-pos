import { fork } from "node:child_process";

/**
 * Runs PDF/Excel parsing in a separate Node process so xlsx/pdf-parse
 * are never bundled into the Electron main vite chunk.
 */
export function parseBinarySupplierFile(filePath, ext, workerPath) {
  return new Promise((resolve, reject) => {
    const child = fork(workerPath, [filePath, ext], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
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
