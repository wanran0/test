-- 宿舍生活分摊工具 · 数据模型 (SQLite)
-- 金额一律以「分」为整数存储 (amount_cents)，杜绝浮点误差。

PRAGMA foreign_keys = ON;

-- 用户（微信 openid 唯一）
CREATE TABLE IF NOT EXISTS app_user (
  id          TEXT PRIMARY KEY,
  openid      TEXT UNIQUE,
  nickname    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 寝室（以寝室为单位使用）
CREATE TABLE IF NOT EXISTS dorm (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  gender      TEXT NOT NULL DEFAULT 'unknown',   -- male | female | mixed | unknown
  owner_id    TEXT NOT NULL REFERENCES app_user(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 寝室成员 + 权限（导师意见：录入/修改权限可分别指定，默认宿舍长持有管理员权限）
CREATE TABLE IF NOT EXISTS dorm_member (
  id          TEXT PRIMARY KEY,
  dorm_id     TEXT NOT NULL REFERENCES dorm(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES app_user(id),
  role        TEXT NOT NULL DEFAULT 'member',     -- dorm_head | member
  can_input   INTEGER NOT NULL DEFAULT 1,          -- 是否可录入
  can_edit    INTEGER NOT NULL DEFAULT 0,          -- 是否可修改
  joined_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (dorm_id, user_id)
);

-- 费用类别（水/电等刨不掉的固定项预制在模板，is_preset=1，允许追加自定义）
CREATE TABLE IF NOT EXISTS expense_category (
  id          TEXT PRIMARY KEY,
  dorm_id     TEXT NOT NULL REFERENCES dorm(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_preset   INTEGER NOT NULL DEFAULT 0,
  default_split_mode TEXT NOT NULL DEFAULT 'equal', -- equal | ratio | designated
  UNIQUE (dorm_id, name)
);

-- 一笔公共费用
CREATE TABLE IF NOT EXISTS expense (
  id             TEXT PRIMARY KEY,
  dorm_id        TEXT NOT NULL REFERENCES dorm(id) ON DELETE CASCADE,
  category_id    TEXT REFERENCES expense_category(id),
  title          TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL CHECK (amount_cents >= 0),
  payer_member_id TEXT NOT NULL REFERENCES dorm_member(id), -- 谁垫付
  split_mode     TEXT NOT NULL DEFAULT 'equal',             -- equal | ratio | designated
  occurred_on    TEXT NOT NULL,                             -- YYYY-MM-DD
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 每笔费用分摊到每位成员的应付金额（由 splitService 计算落库，合计==amount_cents）
CREATE TABLE IF NOT EXISTS expense_share (
  id              TEXT PRIMARY KEY,
  expense_id      TEXT NOT NULL REFERENCES expense(id) ON DELETE CASCADE,
  dorm_member_id  TEXT NOT NULL REFERENCES dorm_member(id),
  weight          REAL NOT NULL DEFAULT 1,        -- ratio 模式下的权重
  share_cents     INTEGER NOT NULL CHECK (share_cents >= 0),
  UNIQUE (expense_id, dorm_member_id)
);

-- 卫生值日项（轮换周期）
CREATE TABLE IF NOT EXISTS chore (
  id          TEXT PRIMARY KEY,
  dorm_id     TEXT NOT NULL REFERENCES dorm(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  cycle       TEXT NOT NULL DEFAULT 'daily',      -- daily | weekly
  base_date   TEXT NOT NULL,                      -- 轮换起点 YYYY-MM-DD
  rotation_members TEXT NOT NULL DEFAULT '[]',    -- 有序 dorm_member id 的 JSON 数组，轮换队列
  UNIQUE (dorm_id, name)
);

-- 排班：循环队列/取模生成，成员顺序用 rotation_index 表示
CREATE TABLE IF NOT EXISTS chore_assignment (
  id             TEXT PRIMARY KEY,
  chore_id       TEXT NOT NULL REFERENCES chore(id) ON DELETE CASCADE,
  dorm_member_id TEXT NOT NULL REFERENCES dorm_member(id),
  due_date       TEXT NOT NULL,
  rotation_index INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | done | skipped | swapped
  UNIQUE (chore_id, due_date)
);

-- 反馈通道（导师意见：需保留用户->管理员反馈入口，先占位）
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  dorm_id     TEXT REFERENCES dorm(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES app_user(id),
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',       -- open | acknowledged | closed
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
