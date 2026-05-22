import { getDb } from './db.js';
import { getSettings } from './settings.js';

function nextBillNo() {
  const last = getDb()
    .prepare('SELECT bill_no FROM emergency_bills ORDER BY id DESC LIMIT 1')
    .get();
  if (!last?.bill_no) return '160920';
  const match = String(last.bill_no).match(/(\d+)$/);
  if (!match) return String(Date.now()).slice(-6);
  return String(Number(match[1]) + 1);
}

function nextRegNo() {
  const last = getDb()
    .prepare('SELECT reg_no FROM emergency_bills ORDER BY id DESC LIMIT 1')
    .get();
  if (!last?.reg_no) return '69189';
  const match = String(last.reg_no).match(/(\d+)$/);
  if (!match) return String(Date.now()).slice(-5);
  return String(Number(match[1]) + 1);
}

export function previewNextEmergencyNumbers() {
  return { billNo: nextBillNo(), regNo: nextRegNo() };
}

function getEmergencyBillItems(billId) {
  return getDb()
    .prepare('SELECT * FROM emergency_bill_items WHERE bill_id = ? ORDER BY id ASC')
    .all(billId);
}

export function createEmergencyBill(data) {
  const database = getDb();
  const insertBill = database.prepare(`
    INSERT INTO emergency_bills (
      bill_no, doctor_name, patient_name, father_guardian_name,
      reg_no, reg_date, reg_time, sex,
      age_years, age_months, age_days,
      paid_amount, due_amount, discount_amount, created_at
    ) VALUES (
      @bill_no, @doctor_name, @patient_name, @father_guardian_name,
      @reg_no, @reg_date, @reg_time, @sex,
      @age_years, @age_months, @age_days,
      @paid_amount, @due_amount, @discount_amount, datetime('now')
    )
  `);

  const insertItem = database.prepare(`
    INSERT INTO emergency_bill_items (bill_id, service_name, rate, discount, paid_amount)
    VALUES (@bill_id, @service_name, @rate, @discount, @paid_amount)
  `);

  const tx = database.transaction(() => {
    const info = insertBill.run({
      bill_no: data.bill_no || nextBillNo(),
      doctor_name: data.doctor_name || '',
      patient_name: data.patient_name || '',
      father_guardian_name: data.father_guardian_name || '',
      reg_no: data.reg_no || nextRegNo(),
      reg_date: data.reg_date,
      reg_time: data.reg_time,
      sex: data.sex || '',
      age_years: Number(data.age_years) || 0,
      age_months: Number(data.age_months) || 0,
      age_days: Number(data.age_days) || 0,
      paid_amount: Number(data.paid_amount) || 0,
      due_amount: Number(data.due_amount) || 0,
      discount_amount: Number(data.discount_amount) || 0,
    });

    for (const item of data.items || []) {
      insertItem.run({
        bill_id: info.lastInsertRowid,
        service_name: item.service_name || '',
        rate: Number(item.rate) || 0,
        discount: Number(item.discount) || 0,
        paid_amount: Number(item.paid_amount) || 0,
      });
    }

    return info.lastInsertRowid;
  });

  return getEmergencyBillById(tx());
}

export function updateEmergencyBill(id, data) {
  const database = getDb();

  const updateBill = database.prepare(`
    UPDATE emergency_bills SET
      bill_no = @bill_no,
      doctor_name = @doctor_name,
      patient_name = @patient_name,
      father_guardian_name = @father_guardian_name,
      reg_no = @reg_no,
      reg_date = @reg_date,
      reg_time = @reg_time,
      sex = @sex,
      age_years = @age_years,
      age_months = @age_months,
      age_days = @age_days,
      paid_amount = @paid_amount,
      due_amount = @due_amount,
      discount_amount = @discount_amount
    WHERE id = @id
  `);

  const insertItem = database.prepare(`
    INSERT INTO emergency_bill_items (bill_id, service_name, rate, discount, paid_amount)
    VALUES (@bill_id, @service_name, @rate, @discount, @paid_amount)
  `);

  const deleteItems = database.prepare('DELETE FROM emergency_bill_items WHERE bill_id = ?');

  const tx = database.transaction(() => {
    deleteItems.run(id);
    updateBill.run({
      id,
      bill_no: data.bill_no,
      doctor_name: data.doctor_name || '',
      patient_name: data.patient_name || '',
      father_guardian_name: data.father_guardian_name || '',
      reg_no: data.reg_no,
      reg_date: data.reg_date,
      reg_time: data.reg_time,
      sex: data.sex || '',
      age_years: Number(data.age_years) || 0,
      age_months: Number(data.age_months) || 0,
      age_days: Number(data.age_days) || 0,
      paid_amount: Number(data.paid_amount) || 0,
      due_amount: Number(data.due_amount) || 0,
      discount_amount: Number(data.discount_amount) || 0,
    });

    for (const item of data.items || []) {
      insertItem.run({
        bill_id: id,
        service_name: item.service_name || '',
        rate: Number(item.rate) || 0,
        discount: Number(item.discount) || 0,
        paid_amount: Number(item.paid_amount) || 0,
      });
    }
  });

  tx();
  return getEmergencyBillById(id);
}

export function getEmergencyBills(filters = {}) {
  const clauses = [];
  const params = {};

  if (filters.search) {
    clauses.push(
      '(patient_name LIKE @search OR bill_no LIKE @search OR reg_no LIKE @search OR doctor_name LIKE @search)',
    );
    params.search = `%${filters.search}%`;
  }
  if (filters.from) {
    clauses.push('date(reg_date) >= date(@from)');
    params.from = filters.from;
  }
  if (filters.to) {
    clauses.push('date(reg_date) <= date(@to)');
    params.to = filters.to;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return getDb()
    .prepare(`SELECT * FROM emergency_bills ${where} ORDER BY id DESC`)
    .all(params);
}

export function getEmergencyBillById(id) {
  const bill = getDb().prepare('SELECT * FROM emergency_bills WHERE id = ?').get(id);
  if (!bill) return null;
  return {
    ...bill,
    bill_type: 'emergency',
    items: getEmergencyBillItems(id),
    settings: getSettings(),
  };
}

export function deleteEmergencyBill(id) {
  getDb().prepare('DELETE FROM emergency_bills WHERE id = ?').run(id);
  return { success: true };
}
