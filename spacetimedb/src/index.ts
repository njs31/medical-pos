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

const spacetimedb = schema(backupSnapshot);
export default spacetimedb;

spacetimedb.reducer(
  'store_backup',
  {
    device_id: t.string(),
    shop_name: t.string(),
    payload: t.string(),
  },
  (ctx, { device_id, shop_name, payload }) => {
    ctx.db.backupSnapshot.insert({
      id: 0n,
      device_id,
      shop_name,
      created_at: ctx.timestamp,
      payload,
    });
  },
);
