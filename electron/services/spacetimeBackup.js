import crypto from 'node:crypto';
import { exportAllData, getExportCounts } from '../database/export.js';
import { getSettings, saveSettings } from '../database/settings.js';
import { readTokenFromCliCommand, validateSpacetimeToken } from './spacetimeCli.js';

const DEFAULT_HOST = 'https://maincloud.spacetimedb.com';

function normalizeHost(host) {
  return String(host || DEFAULT_HOST).trim().replace(/\/+$/, '') || DEFAULT_HOST;
}

function getOrCreateDeviceId(settings) {
  if (settings?.backup_device_id) return settings.backup_device_id;
  const deviceId = crypto.randomUUID();
  saveSettings({ ...settings, backup_device_id: deviceId });
  return deviceId;
}

export async function backupToSpacetimeDB() {
  const settings = getSettings();
  const host = normalizeHost(settings?.spacetime_host);
  const database = String(settings?.spacetime_database || '').trim();
  const tokenCheck = validateSpacetimeToken(settings?.spacetime_token);

  if (!tokenCheck.ok) {
    return { success: false, message: tokenCheck.message };
  }

  const token = tokenCheck.token;

  if (!database) {
    return {
      success: false,
      message: 'Set SpacetimeDB database name in Settings → Cloud Backup before backing up.',
    };
  }

  const snapshot = exportAllData();
  const payload = JSON.stringify(snapshot);
  const deviceId = getOrCreateDeviceId(settings);
  const shopName = settings?.shop_name || 'Medical POS';

  const url = `${host}/v1/database/${encodeURIComponent(database)}/call/store_backup`;
  const headers = {
    'Content-Type': 'application/json',
  };
  headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify([deviceId, shopName, payload]),
    });
  } catch (error) {
    return {
      success: false,
      message: `Could not reach SpacetimeDB: ${error.message}`,
    };
  }

  const responseText = await response.text();
  let responseBody = responseText;
  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    // keep raw text
  }

  if (!response.ok) {
    const detail =
      typeof responseBody === 'string'
        ? responseBody
        : responseBody?.message || responseBody?.error || JSON.stringify(responseBody);
    return {
      success: false,
      message: `SpacetimeDB backup failed (${response.status}): ${detail || 'Unknown error'}`,
    };
  }

  return {
    success: true,
    exported_at: snapshot.exported_at,
    device_id: deviceId,
    database,
    counts: getExportCounts(snapshot),
  };
}

export function loadSpacetimeTokenFromCli() {
  const token = readTokenFromCliCommand();
  if (!token) {
    return {
      success: false,
      message: 'No token found. Run: spacetime login then spacetime login show --token',
    };
  }

  const check = validateSpacetimeToken(token);
  if (!check.ok) {
    return { success: false, message: check.message };
  }

  const settings = getSettings();
  saveSettings({
    ...settings,
    spacetime_host: settings?.spacetime_host || DEFAULT_HOST,
    spacetime_token: check.token,
  });

  return { success: true, message: 'Token loaded from Spacetime CLI and saved.' };
}
