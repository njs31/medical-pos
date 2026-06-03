import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function cliConfigPath() {
  const candidates = [
    path.join(os.homedir(), '.config', 'spacetime', 'cli.toml'),
    path.join(os.homedir(), 'Library', 'Application Support', 'spacetime', 'cli.toml'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export function readTokenFromCliConfig() {
  const configPath = cliConfigPath();
  if (!configPath) return null;

  const content = fs.readFileSync(configPath, 'utf8');
  const match = content.match(/spacetimedb_token\s*=\s*"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

export function readTokenFromCliCommand() {
  try {
    const output = execSync('spacetime login show --token', {
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const labeled = output.match(/auth token[^]*?\bis\s+(eyJ[^\s]+)/i);
    if (labeled?.[1]) return labeled[1].trim();

    const jwt = output.match(/(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
    return jwt?.[1]?.trim() || null;
  } catch {
    return readTokenFromCliConfig();
  }
}

export function normalizeSpacetimeToken(raw) {
  let token = String(raw || '').trim();
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }
  return token;
}

export function isJwtToken(token) {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

export function validateSpacetimeToken(token) {
  const normalized = normalizeSpacetimeToken(token);
  if (!normalized) {
    return { ok: false, message: 'Bearer token is empty. Run: spacetime login show --token' };
  }
  if (isJwtToken(normalized)) {
    return { ok: true, token: normalized };
  }
  if (/^c200[a-f0-9]{60,}$/i.test(normalized)) {
    return {
      ok: false,
      message:
        'That looks like your Spacetime identity, not your auth token. Run: spacetime login show --token and paste the long eyJ... value.',
    };
  }
  return {
    ok: false,
    message:
      'Invalid token format. Use: spacetime login show --token and paste the full eyJ... JWT (not the identity hex).',
  };
}
