# SpacetimeDB backup module

This module stores full POS snapshots when you click the cloud backup icon in the app.

## One-time setup

1. Install the SpacetimeDB CLI (macOS/Linux):

```bash
curl -sSf https://install.spacetimedb.com | sh
```

Then restart your terminal and run `spacetime version`.

2. Log in: `spacetime login`
3. Get your **auth token** (must start with `eyJ` — not the identity hex):

```bash
spacetime login show --token
```

4. From this folder, publish the module:

```bash
cd spacetimedb
npm install
spacetime publish medical-pos-backup -p . -y
```

(`-p .` is the module folder; `-y` skips confirmations. From the repo root you can use `spacetime publish medical-pos-backup -p spacetimedb -y` instead.)

5. In the app, open **Settings → Cloud Backup** and set:
   - **Host:** `https://maincloud.spacetimedb.com` (default)
   - **Database name:** `medical-pos-backup` (same name used in publish)
   - **Token:** paste the `eyJ...` JWT from step 3, or click **Load token from Spacetime CLI**

## Restore data

Query backups from SpacetimeDB:

```bash
spacetime sql medical-pos-backup "SELECT id, device_id, shop_name, created_at FROM backup_snapshot ORDER BY id DESC LIMIT 5"
```

Each row's `payload` column contains the full JSON export (medicines, bills, suppliers, settings, etc.).
