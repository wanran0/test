const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = process.cwd();
const T = path.join(dir, 'data', 'migration-test.db');
fs.mkdirSync(path.dirname(T), { recursive: true });
try { fs.unlinkSync(T); } catch {}

const d0 = new DatabaseSync(T);
d0.exec([
  "CREATE TABLE app_user (id TEXT PRIMARY KEY, openid TEXT UNIQUE, nickname TEXT NOT NULL, created_at TEXT)",
  "CREATE TABLE dorm (id TEXT PRIMARY KEY, name TEXT NOT NULL, gender TEXT, owner_id TEXT, created_at TEXT)",
  "CREATE TABLE feedback (id TEXT PRIMARY KEY, dorm_id TEXT, user_id TEXT, content TEXT NOT NULL, status TEXT, created_at TEXT)",
  "INSERT INTO app_user (id, openid, nickname) VALUES ('u1','o1','邹向惠')",
  "INSERT INTO dorm (id, name, gender, owner_id) VALUES ('d1','1号楼404','male','u1')",
  "INSERT INTO feedback (id, dorm_id, user_id, content, status, created_at) VALUES ('f1','d1','u1','旧数据一条','open','2026-10-01 08:00:00')",
].join(';\n') + ';');
d0.close();

const run = () => execFileSync(process.execPath, ['src/db/init.js'], {
  cwd: dir, encoding: 'utf8', env: { ...process.env, DB_PATH: T },
});
const first = run();
const second = run();

const db = new DatabaseSync(T);
const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
let failed = 0;
const check = (c, m) => { if (!c) failed++; console.log((c ? '  \u2713 ' : '  \u2717 FAIL: ') + m); };

console.log('[run1 输出]', first.trim().split('\n').pop());
console.log('[run2 输出]', second.trim().split('\n').pop());
console.log('\n迁移断言');
check(/migrated columns:/.test(first), '第一次启动补齐缺失列');
check(!/migrated columns:/.test(second), '第二次启动幂等（不再补列）');
check(cols('app_user').includes('is_admin'), 'app_user.is_admin 已补齐');
check(cols('dorm').includes('report_consent') && cols('dorm').includes('consented_at'), 'dorm 授权列已补齐');
for (const c of ['category', 'rating', 'reply', 'handled_by', 'updated_at'])
  check(cols('feedback').includes(c), `feedback.${c} 已补齐`);
check(db.prepare("SELECT is_admin FROM app_user WHERE id='u1'").get().is_admin === 0, '老用户保留且默认非管理员');
check(db.prepare("SELECT report_consent FROM dorm WHERE id='d1'").get().report_consent === 0, '老寝室默认未授权（保守默认）');
const oldFb = db.prepare("SELECT category, updated_at, created_at FROM feedback WHERE id='f1'").get();
check(oldFb.category === 'feature', '老反馈行获得默认 category');
check(oldFb.updated_at === oldFb.created_at, '老反馈行 updated_at 已回填为 created_at');
db.close();

// 新库路径：新插入的反馈应自带 updated_at
const T2 = path.join(dir, 'data', 'fresh-test.db');
try { fs.unlinkSync(T2); } catch {}
execFileSync(process.execPath, ['src/db/init.js'], { cwd: dir, encoding: 'utf8', env: { ...process.env, DB_PATH: T2 } });
const dbf = new DatabaseSync(T2);
dbf.exec("INSERT INTO app_user (id, openid, nickname) VALUES ('u9','o9','x')");
dbf.exec("INSERT INTO feedback (id, user_id, content, created_at, updated_at) VALUES ('f9','u9','新数据', datetime('now'), datetime('now'))");
check(dbf.prepare("SELECT updated_at FROM feedback WHERE id='f9'").get().updated_at !== null, '新库 updated_at 正常写入');
dbf.close();
fs.unlinkSync(T2);
fs.unlinkSync(T);

console.log(`\n迁移验证: ${failed === 0 ? '全部通过' : failed + ' 项失败'}`);
process.exit(failed ? 1 : 0);
