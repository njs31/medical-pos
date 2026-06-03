import { schema, table, t } from 'spacetimedb/server';

const backupSnapshot = table(
  { name: 'backup_snapshot', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    device_id: t.string(),
    shop_name: t.string(),
    created_at: t.timestamp(),
    payload: t.string(),
  },
);

const spacetimedb = schema({ backup_snapshot: backupSnapshot });
export default spacetimedb;

export const store_backup = spacetimedb.reducer(
  { device_id: t.string(), shop_name: t.string(), payload: t.string() },
  (ctx, { device_id, shop_name, payload }) => {
    ctx.db.backup_snapshot.insert({
      id: 0n,
      device_id,
      shop_name,
      created_at: ctx.timestamp,
      payload,
    });
  },
);
