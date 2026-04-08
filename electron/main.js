import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import {
  createBill,
  deleteBill,
  getBillById,
  getBills,
  getDashboardSummary,
  getSalesSummary,
  getStockReport,
  previewNextInvoiceNo,
} from './database/bills.js';
import { initDatabase, closeDatabase } from './database/db.js';
import {
  addMedicine,
  adjustMedicineStock,
  deleteMedicine,
  getAllMedicines,
  importMedicines,
  searchMedicines,
  updateMedicine,
} from './database/medicines.js';
import { getSettings, saveSettings } from './database/settings.js';
import { getAllSuppliers, addSupplier, deleteSupplier } from './database/suppliers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
let mainWindow;

function getPreloadPath() {
  return path.join(__dirname, '../preload/preload.mjs');
}

function getRendererIndexPath() {
  return isDev ? null : path.join(__dirname, '../../dist/index.html');
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#F8FAFC',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(getRendererIndexPath());
  }

  const focusRenderer = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.focus();
    mainWindow.webContents.focus();
  };

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    focusRenderer();
    setTimeout(focusRenderer, 150);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(focusRenderer, 100);
  });

  mainWindow.on('focus', () => {
    setTimeout(focusRenderer, 0);
  });
}

async function printBill(billIdOrData) {
  let bill;
  let isRaw = false;
  if (typeof billIdOrData === 'object' && billIdOrData !== null) {
    bill = billIdOrData;
    isRaw = true;
  } else {
    bill = getBillById(billIdOrData);
  }

  const targetUrl = isDev
    ? `http://localhost:5173/#/print/${isRaw ? 'raw' : billIdOrData}`
    : `file://${getRendererIndexPath()}#/print/${isRaw ? 'raw' : billIdOrData}`;

  const printWindow = new BrowserWindow({
    width: 900,
    height: 1200,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  await printWindow.loadURL(targetUrl);

  if (isRaw) {
    const settings = getSettings();
    await printWindow.webContents.executeJavaScript(`
      window.__PRINT_DATA__ = ${JSON.stringify({ ...bill, settings })};
    `);
  }

  await printWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => setTimeout(resolve, 300));
      } else {
        setTimeout(resolve, 300);
      }
    });
  `);

  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const printContents = printWindow.webContents;

      const cleanup = () => {
        if (printContents && !printContents.isDestroyed()) {
          printContents.removeListener('render-process-gone', handleRenderGone);
        }
        if (!printWindow.isDestroyed()) {
          printWindow.removeListener('closed', handleClosed);
        }
      };

      const finish = (callback) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const handleClosed = () => finish(resolve);
      const handleRenderGone = () => finish(() => reject(new Error('Print window closed unexpectedly')));

      printWindow.on('closed', handleClosed);
      printContents.on('render-process-gone', handleRenderGone);

      printWindow.show();
      printWindow.focus();

      printContents.executeJavaScript(`
        new Promise((innerResolve) => {
          const done = () => {
            window.removeEventListener('afterprint', done);
            setTimeout(() => {
              window.close();
              innerResolve(true);
            }, 150);
          };

          window.addEventListener('afterprint', done, { once: true });
          setTimeout(() => window.print(), 100);
        });
      `).catch((error) => finish(() => reject(error)));
    });
  } catch (error) {
    if (!printWindow.isDestroyed()) printWindow.close();
    return { success: false, mode: 'print-error', message: error.message };
  }

  if (!printWindow.isDestroyed()) printWindow.close();
  return { success: true, mode: 'print' };
}

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(header) {
  return String(header || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseNumber(value, fallback = 0) {
  const normalized = String(value ?? '')
    .replace(/[₹,\s]/g, '')
    .trim();
  if (!normalized) return fallback;
    const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeExpiryStr(expiry) {
  const parts = String(expiry || '').split('/');
  if (parts.length !== 2) return String(expiry || '').trim();
  const m = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(y)) return String(expiry || '').trim();
  const fm = String(m).padStart(2, '0');
  const fy = String(y).length === 4 ? String(y).slice(-2) : String(y).padStart(2, '0');
  return `${fm}/${fy}`;
}

function parseCsv(content) {
  const rows = parseCsvRows(content);
  if (!rows.length) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map(normalizeHeader);

  return dataRows.map((values) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = String(values[index] ?? '').trim();
    });

    return {
      name: item.name || item.product_name || item.product || '',
      pack: item.pack || item.pack_size || '',
      hsn_code: item.hsn_code || item.hsn || '',
      batch: item.batch || item.batch_number || '',
      expiry: normalizeExpiryStr(item.expiry || item.exp_date || item.exp || ''),
      mrp: parseNumber(item.mrp),
      rate: parseNumber(item.rate || item.selling_rate),
      purchase_rate: parseNumber(item.purchase_rate, parseNumber(item.rate || item.selling_rate)),
      sgst_percent: 0,
      cgst_percent: 0,
      stock_qty: parseNumber(item.stock_qty || item.stock || item.current_stock_quantity),
      reorder_level: parseNumber(item.reorder_level, 10),
      tablets_per_sheet: parseNumber(item.tablets_per_sheet || item.tab_per_sheet, 0),
      supplier_name: item.supplier_name || item.supplier || '',
      item_category: item.item_category || item.category || 'Medicine',
      rack_number: item.rack_number || item.rack || '',
    };
  });
}

function toCsv(rows) {
  const headers = [
    'name',
    'pack',
    'hsn_code',
    'batch',
    'expiry',
    'mrp',
    'rate',
    'purchase_rate',
    'stock_qty',
    'reorder_level',
    'tablets_per_sheet',
    'supplier_name',
    'item_category',
    'rack_number',
  ];
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? '')).join(','));
  });
  return lines.join('\n');
}

autoUpdater.logger = log;
autoUpdater.autoDownload = false;

app.whenReady().then(() => {
  log.info('Application starting...');
  log.info('User Data path:', app.getPath('userData'));
  
  try {
    log.info('Initializing database...');
    initDatabase();
    log.info('Database initialized successfully.');
    
    log.info('Creating main window...');
    createMainWindow();
    log.info('Main window created.');
  } catch (error) {
    log.error('Startup error:', error.message);
    log.error('Stack:', error.stack);
    
    dialog.showErrorBox(
      'Startup Error',
      `The application failed to start correctly.\n\nError: ${error.message}\n\nThis could be due to a missing Windows dependency (Visual C++ Redistributable) or an architecture mismatch.\n\nStack Trace:\n${error.stack}`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('medicines:getAll', async () => getAllMedicines());
ipcMain.handle('medicines:search', async (_, query) => searchMedicines(query));
ipcMain.handle('medicines:add', async (_, data) => addMedicine(data));
ipcMain.handle('medicines:update', async (_, id, data) => updateMedicine(id, data));
ipcMain.handle('medicines:delete', async (_, id) => deleteMedicine(id));
ipcMain.handle('medicines:adjustStock', async (_, id, qty) => adjustMedicineStock(id, qty));
ipcMain.handle('medicines:importCsv', async (_, content) => importMedicines(parseCsv(content)));
ipcMain.handle('system:exportDatabase', async () => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'pharmacy-pos.sqlite');
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Database Backup',
      defaultPath: `pharmacy-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
    });

    if (canceled || !filePath) return { success: false };
    await fs.copyFile(dbPath, filePath);
    return { success: true };
  } catch (error) {
    console.error('Database export failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('system:importDatabase', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Database Backup To Restore',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
    });

    if (canceled || filePaths.length === 0) return { success: false };
    
    const dbPath = path.join(app.getPath('userData'), 'pharmacy-pos.sqlite');
    closeDatabase(); // Important to release file handle

    await fs.copyFile(filePaths[0], dbPath);
    
    // Relaunch the app to pick up new database
    app.relaunch();
    app.exit(0);
    
    return { success: true };
  } catch (error) {
    console.error('Database import failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bills:create', async (_, billData) => createBill(billData));
ipcMain.handle('bills:getAll', async (_, filters) => getBills(filters));
ipcMain.handle('bills:getById', async (_, id) => getBillById(id));
ipcMain.handle('bills:delete', async (_, id) => deleteBill(id));
ipcMain.handle('bills:print', async (_, id) => printBill(id));
ipcMain.handle('bills:printRaw', async (_, billData) => printBill(billData));
ipcMain.handle('bills:getNextInvoiceNo', async () => previewNextInvoiceNo());
ipcMain.handle('dashboard:summary', async () => getDashboardSummary());

ipcMain.handle('reports:sales', async (_, from, to) => getSalesSummary(from, to));
ipcMain.handle('reports:stock', async () => getStockReport());

ipcMain.handle('settings:get', async () => getSettings());
ipcMain.handle('settings:save', async (_, data) => saveSettings(data));

ipcMain.handle('suppliers:getAll', async () => getAllSuppliers());
ipcMain.handle('suppliers:add', async (_, supplier) => addSupplier(supplier));
ipcMain.handle('suppliers:delete', async (_, id) => deleteSupplier(id));

ipcMain.handle('updater:check', async () => {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (error) {
    log.error('Update check failed:', error);
    throw error;
  }
});

ipcMain.handle('updater:download', async () => autoUpdater.downloadUpdate());
ipcMain.handle('updater:install', async () => autoUpdater.quitAndInstall());

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('updater:available', info);
});

autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('updater:not-available');
});

autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('updater:error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('updater:download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('updater:downloaded', info);
});

process.on('uncaughtException', (error) => {
  log.error(error);
});
