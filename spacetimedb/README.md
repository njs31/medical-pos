# SpacetimeDB backup module

This module stores full POS snapshots when you click the cloud backup icon in the app.

## One-time setup

1. Install the SpacetimeDB CLI (macOS/Linux):

```bash
curl -sSf https://install.spacetimedb.com | sh
```

Then restart your terminal and run `spacetime version`.

2. Log in: `spacetime login`
3. From this folder, publish the module:

```bash
cd spacetimedb
npm install
spacetime publish medical-pos-backup --project-path .
```

4. In the app, open **Settings → Cloud Backup** and set:
   - **Host:** `https://maincloud.spacetimedb.com` (default)
   - **Database name:** `medical-pos-backup` (same name used in publish)
   - **Token:** your SpacetimeDB bearer token (from `spacetime login` or the dashboard)

## Restore data

Query backups from SpacetimeDB:

```bash
spacetime sql medical-pos-backup "SELECT id, device_id, shop_name, created_at FROM backup_snapshot ORDER BY id DESC LIMIT 5"
```

Each row's `payload` column contains the full JSON export (medicines, bills, suppliers, settings, etc.).
