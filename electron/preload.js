import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  medicines: {
    getAll: () => ipcRenderer.invoke('medicines:getAll'),
    search: (query) => ipcRenderer.invoke('medicines:search', query),
    add: (data) => ipcRenderer.invoke('medicines:add', data),
    update: (id, data) => ipcRenderer.invoke('medicines:update', id, data),
    delete: (id) => ipcRenderer.invoke('medicines:delete', id),
    adjustStock: (id, qty) => ipcRenderer.invoke('medicines:adjustStock', id, qty),
    importCsv: (content) => ipcRenderer.invoke('medicines:importCsv', content),
    exportCsv: () => ipcRenderer.invoke('medicines:exportCsv'),
  },
  bills: {
    create: (billData) => ipcRenderer.invoke('bills:create', billData),
    getAll: (filters) => ipcRenderer.invoke('bills:getAll', filters),
    getById: (id) => ipcRenderer.invoke('bills:getById', id),
    delete: (id) => ipcRenderer.invoke('bills:delete', id),
    print: (id) => ipcRenderer.invoke('bills:print', id),
    getNextInvoiceNo: () => ipcRenderer.invoke('bills:getNextInvoiceNo'),
    getDashboardSummary: () => ipcRenderer.invoke('dashboard:summary'),
  },
  reports: {
    getSalesSummary: (from, to) => ipcRenderer.invoke('reports:sales', from, to),
    getStockReport: () => ipcRenderer.invoke('reports:stock'),
    getGSTReport: (month, year) => ipcRenderer.invoke('reports:gst', month, year),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (data) => ipcRenderer.invoke('settings:save', data),
  },
  suppliers: {
    getAll: () => ipcRenderer.invoke('suppliers:getAll'),
    add: (data) => ipcRenderer.invoke('suppliers:add', data),
    delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    onUpdateAvailable: (cb) => {
      const l = (_, info) => cb(info);
      ipcRenderer.on('updater:available', l);
      return () => ipcRenderer.removeListener('updater:available', l);
    },
    onUpdateNotAvailable: (cb) => {
      const l = () => cb();
      ipcRenderer.on('updater:not-available', l);
      return () => ipcRenderer.removeListener('updater:not-available', l);
    },
    onUpdateError: (cb) => {
      const l = (_, err) => cb(err);
      ipcRenderer.on('updater:error', l);
      return () => ipcRenderer.removeListener('updater:error', l);
    },
    onDownloadProgress: (cb) => {
      const l = (_, p) => cb(p);
      ipcRenderer.on('updater:download-progress', l);
      return () => ipcRenderer.removeListener('updater:download-progress', l);
    },
    onUpdateDownloaded: (cb) => {
      const l = (_, info) => cb(info);
      ipcRenderer.on('updater:downloaded', l);
      return () => ipcRenderer.removeListener('updater:downloaded', l);
    },
  },
});
