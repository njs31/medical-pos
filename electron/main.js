import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log';
import {
  createBill,
  deleteBill,
  getBillById,
  getBills,
  getDashboardSummary,
  getGstReport,
  getSalesSummary,
  getStockReport,
  previewNextInvoiceNo,
} from './database/bills.js';
import { initDatabase } from './database/db.js';
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
}

async function printBill(billId) {
  const bill = getBillById(billId);
  const targetUrl = isDev
    ? `http://localhost:5173/#/print/${billId}`
    : `file://${getRendererIndexPath()}#/print/${billId}`;

  const printWindow = new BrowserWindow({
    width: 900,
    height: 1200,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  await printWindow.loadURL(targetUrl);
  await printWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => setTimeout(resolve, 300));
      } else {
        setTimeout(resolve, 300);
      }
    });
  `);

  const settings = getSettings();
  const copies = Number(settings.copies || 1);
  const printers = await printWindow.webContents.getPrintersAsync();

  if (!printers.length) {
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: settings.paper_size === '80mm' ? 'A4' : 'A4',
      landscape: false,
    });

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Invoice PDF',
      defaultPath: `${bill?.invoice_no || `invoice-${billId}`}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (!canceled && filePath) {
      await fs.writeFile(filePath, pdfBuffer);
      printWindow.close();
      return { success: true, mode: 'pdf', filePath };
    }

    printWindow.close();
    return { success: false, mode: 'pdf-cancelled' };
  }

  for (let i = 0; i < copies; i += 1) {
    await new Promise((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
          margins: { marginType: 'default' },
          pageSize: settings.paper_size === '80mm' ? { width: 315000, height: 1100000 } : 'A4',
        },
        (success, errorType) => {
          if (!success) reject(new Error(errorType || 'Printing failed'));
          else resolve();
        },
      );
    });
  }

  printWindow.close();
  return { success: true, mode: 'print' };
}

function parseCsv(content) {
  const [headerLine, ...rows] = content.split(/\r?\n/).filter(Boolean);
  if (!headerLine) return [];
  const headers = headerLine.split(',').map((part) => part.trim());
  return rows.map((row) => {
    const values = row.split(',').map((part) => part.trim());
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] || '';
    });
    return {
      name: item.name || item.product_name || '',
      pack: item.pack || '',
      hsn_code: item.hsn_code || '',
      batch: item.batch || '',
      expiry: item.expiry || '',
      mrp: Number(item.mrp || 0),
      rate: Number(item.rate || 0),
      purchase_rate: Number(item.purchase_rate || item.rate || 0),
      sgst_percent: Number(item.sgst_percent || 6),
      cgst_percent: Number(item.cgst_percent || 6),
      stock_qty: Number(item.stock_qty || 0),
      reorder_level: Number(item.reorder_level || 10),
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
    'sgst_percent',
    'cgst_percent',
    'stock_qty',
    'reorder_level',
  ];
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? '')).join(','));
  });
  return lines.join('\n');
}

app.whenReady().then(() => {
  initDatabase();
  createMainWindow();

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
ipcMain.handle('medicines:exportCsv', async () => {
  const csv = toCsv(getAllMedicines());
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: 'inventory-export.csv',
  });
  if (!canceled && filePath) {
    await import('node:fs/promises').then((fs) => fs.writeFile(filePath, csv, 'utf-8'));
  }
  return { success: !canceled, csv };
});

ipcMain.handle('bills:create', async (_, billData) => createBill(billData));
ipcMain.handle('bills:getAll', async (_, filters) => getBills(filters));
ipcMain.handle('bills:getById', async (_, id) => getBillById(id));
ipcMain.handle('bills:delete', async (_, id) => deleteBill(id));
ipcMain.handle('bills:print', async (_, id) => printBill(id));
ipcMain.handle('bills:getNextInvoiceNo', async () => previewNextInvoiceNo());
ipcMain.handle('dashboard:summary', async () => getDashboardSummary());

ipcMain.handle('reports:sales', async (_, from, to) => getSalesSummary(from, to));
ipcMain.handle('reports:stock', async () => getStockReport());
ipcMain.handle('reports:gst', async (_, month, year) => getGstReport(month, year));

ipcMain.handle('settings:get', async () => getSettings());
ipcMain.handle('settings:save', async (_, data) => saveSettings(data));

process.on('uncaughtException', (error) => {
  log.error(error);
});
