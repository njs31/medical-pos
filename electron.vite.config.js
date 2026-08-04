import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

function copySupplierWorkerPlugin() {
  return {
    name: 'copy-supplier-worker',
    closeBundle() {
      const from = path.resolve('electron/services/supplierFileWorker.mjs');
      const toDir = path.resolve('out/main');
      const to = path.join(toDir, 'supplierFileWorker.mjs');
      fs.mkdirSync(toDir, { recursive: true });
      fs.copyFileSync(from, to);
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copySupplierWorkerPlugin()],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'electron/main.js'),
        },
        external: ['xlsx', 'pdf-parse'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          preload: path.resolve(__dirname, 'electron/preload.js'),
        },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
        },
      },
    },
  },
});
