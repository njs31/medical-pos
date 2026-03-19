import { getDb } from './db.js';

export function getSettings() {
  return getDb().prepare('SELECT * FROM shop_settings WHERE id = 1').get();
}

export function saveSettings(data) {
  getDb().prepare(`
    UPDATE shop_settings SET
      shop_name = @shop_name,
      address = @address,
      phone = @phone,
      gstin = @gstin,
      logo_path = @logo_path,
      default_doctor = @default_doctor,
      invoice_prefix = @invoice_prefix,
      invoice_start = @invoice_start,
      default_discount = @default_discount,
      terms = @terms,
      footer_message = @footer_message,
      paper_size = @paper_size,
      show_hsn = @show_hsn,
      copies = @copies
    WHERE id = 1
  `).run(data);
  return getSettings();
}
