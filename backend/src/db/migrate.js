// 幂等列迁移：CREATE TABLE IF NOT EXISTS 不会给已存在的表补新列，
// 所以老成员的本地库需要靠这里对齐。重复执行安全。
//
// 注意：SQLite 的 ALTER TABLE ADD COLUMN 只接受「恒定默认值」，
// DEFAULT (datetime('now')) 这类表达式默认值会直接报错，
// 因此可空列不写默认值，改为回填；需要默认值的列用常量默认。
const ADD_COLUMNS = [
  { table: 'app_user', column: 'is_admin', ddl: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'dorm', column: 'report_consent', ddl: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'dorm', column: 'consented_at', ddl: 'TEXT' },
  { table: 'feedback', column: 'category', ddl: "TEXT NOT NULL DEFAULT 'feature'" },
  { table: 'feedback', column: 'rating', ddl: 'INTEGER' },
  { table: 'feedback', column: 'reply', ddl: 'TEXT' },
  { table: 'feedback', column: 'handled_by', ddl: 'TEXT' },
  // 无默认值：老行回填为 created_at，新行由仓储层显式写入
  { table: 'feedback', column: 'updated_at', ddl: 'TEXT', backfill: 'UPDATE feedback SET updated_at = created_at WHERE updated_at IS NULL' },
];

function columnsOf(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

export function runMigrations(db) {
  const added = [];
  for (const { table, column, ddl, backfill } of ADD_COLUMNS) {
    const existing = columnsOf(db, table);
    if (existing.size === 0) continue; // 表还不存在，交给 schema.sql
    if (!existing.has(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
      if (backfill) db.exec(backfill);
      added.push(`${table}.${column}`);
    }
  }
  return added;
}
