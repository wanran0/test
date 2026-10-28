# 宿舍生活分摊工具 · 后端骨架

Node.js + Express + 内置 `node:sqlite`（零原生依赖，Node ≥ 22.5）。
当前只做后端，微信小程序前端待下一轮。

## 运行

```bash
cd backend
npm install          # 仅装 express
npm start            # http://localhost:3000/api/health
npm run dev          # 开发热重载 (node --watch)
npm run smoke        # API 冒烟测试（需服务已在运行）
npm run test:db      # 列迁移测试（无需服务，自造旧 schema 库验证）
```

环境变量（见 `.env.example`，用 `node --env-file=.env src/server.js` 加载）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | 3000 | 监听端口 |
| `DB_PATH` | `./data/app.db` | SQLite 文件（已 gitignore） |
| `AUTH_SECRET` | dev 值 | token HMAC 密钥，生产必改 |
| `ADMIN_CODES` | `dev-admin` | 开发组管理员登录 code（逗号分隔）；未设置时启动打印告警 |
| `WX_APPID` / `WX_APPSECRET` | 空 | 正式微信登录换 openid 用，当前 mock 未使用 |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | 空 | 留空 = 离线占位报告；填上任一 OpenAI 兼容服务 |

## 分层结构

```
src/
  config.js              配置(端口/DB/密钥/管理员白名单/AI)
  server.js / app.js     入口(建库+告警) / Express 装配
  db/                    node:sqlite 连接、schema.sql、setup、migrate(幂等补列)、init
  models/                数据访问(repo)，SQL 只出现在这里
  services/              纯业务算法：split 分摊 · schedule 排班 · stats 统计对比 · ai 月报
  controllers/           编排 repo+service，处理 HTTP 语义
  routes/                路由与中间件装配
  middleware/            requireAuth / requireMember / requireInput / requireAdmin / requireDormHead / 错误处理
  utils/                 money(整数分+最大余额法)、token(HMAC)、ids
scripts/                 smoke.mjs(API) · migration-test.cjs(迁移)
```

## 核心模型（对应导师意见）

- 以 **寝室(dorm)** 为单位；创建者自动为 **宿舍长(dorm_head)**。
- **权限分离**：`dorm_member.can_input` / `can_edit`，默认宿舍长全权，支持指定不同人分管不同费用。
- **预置类别**：建寝即写入「电费/水费」两个 `is_preset` 类别，可追加自定义。
- **金额用整数分**：`amount_cents` / `share_cents`，杜绝浮点误差。
- **三种分摊**：`equal`(均摊) / `ratio`(按比例，如高功耗成员权重更高) / `designated`(直接指定每人金额)。
- **排班轮换**：`chore.rotation_members` 有序队列 + 取模生成 `chore_assignment`，支持 daily/weekly。
- **公开授权**：`dorm.report_consent` + `consented_at`，**默认关闭**，仅宿舍长可开关，撤回即从对比池移除。
- **管理员**：`app_user.is_admin`，由 `ADMIN_CODES` 白名单在登录时授予，用于反馈处理与测评汇总。

## API 一览

### 账户与寝室

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | 模拟微信登录，返回 token（code 命中白名单则授予 is_admin） | 公开 |
| POST | `/api/dorms` | 建寝（自动设宿舍长 + 预置水电类别） | 登录 |
| GET/POST | `/api/dorms/:dormId/members` | 成员列表 / 加人 | 成员 / 录入 |
| GET/POST | `/api/dorms/:dormId/categories` | 类别列表 / 追加自定义类别 | 成员 / 录入 |

### 费用与排班

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET/POST | `/api/dorms/:dormId/expenses` | 账单列表 / 记账并自动算分摊 | 成员 / 录入 |
| GET/POST | `/api/dorms/:dormId/chores` | 值日项列表 / 建项并按需生成排班 | 成员 / 录入 |
| GET | `/api/expenses/:expenseId` | 单笔费用含每人应付 | 登录 |
| GET | `/api/chores/:choreId/schedule` | 某值日项排班表 | 登录 |

记账请求体：`{ title, amountYuan|amountCents, payerMemberId, splitMode, occurredOn, categoryId?, note?, participants?: [{ memberId, weight? , cents? }] }`；`participants` 省略时默认全体室友均摊。

### 公开授权与费用对比（新增）

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| PUT | `/api/dorms/:dormId/consent` | 开关「同意公开匿名对比」`{ reportConsent: bool }` | **仅宿舍长** |
| GET | `/api/dorms/:dormId/stats/self?month=YYYY-MM` | 本寝汇总：总额/按类别/按月人均（不依赖他人授权） | 成员 |
| GET | `/api/dorms/:dormId/stats/benchmark?month=` | 本寝 vs 群体：人均、均值、偏差百分比、名次 | 成员 |
| GET | `/api/stats/compare?month=YYYY-MM` | 已授权寝室的**匿名**横向对比 + 男女分组均值 | 登录 |

隐私设计（三条硬约束，均有测试覆盖）：

1. **默认不公开**：`report_consent` 默认 0，未授权寝室绝不进入对比结果。
2. **k-匿名保护**：已授权寝室少于 `MIN_CONSENTED_DORMS`(=3) 时，对比接口返回 **409** 并说明原因，避免小样本被反推识别。
3. **输出脱敏**：对比项只含 `寝室#<id前6位>` 别名与聚合数字，不含寝室名、成员、真实 id；未授权寝室仍可用 `benchmark` 看到群体均值（只是自己不出现在别人列表里）。

### 反馈渠道（新增）

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/api/feedback` | 提交反馈 `{ content, category, rating?, dormId? }` | 登录（关联他寝则 403） |
| GET | `/api/dorms/:dormId/feedback` | 本寝反馈列表 | 成员 |
| GET | `/api/admin/feedback` | 全部反馈（可按 `status` 过滤） | **管理员** |
| PATCH | `/api/admin/feedback/:id` | 处理反馈 `{ status?, reply? }`，自动记录处理人 | **管理员** |
| GET | `/api/admin/feedback/summary` | **测评汇总**：总数/采纳数/回复数/平均处理小时数 + 按状态与类别分布 | **管理员** |

`category`：`feature`(需求) / `bug`(缺陷) / `experience`(体验) / `other`；
`status`：`open` → `acknowledged` → `planned` → `closed`。
`summary` 的返回结构可直接摘录进课程测评文档（采纳率 = adopted / total）。

### AI 月报（新增，占位实现）

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/ai/provider` | 查看当前实现（`placeholder` / `openai-compatible`） | 登录 |
| GET | `/api/dorms/:dormId/ai/report?month=YYYY-MM` | 生成月报，返回 `prompt`(给模型的输入) + `report` + `data`(原始统计) | 成员 |
| GET | `/api/ai/overview?month=` | 群体概览（同样受 k-匿名保护） | 登录 |

当前是**离线占位**：报告由本寝真实账目套模板生成，零网络零密钥即可演示，并在文末显式声明未调用外部模型。
`prompt` 字段是可直接复用的提示词——接真实模型时，把它丢给 OpenAI 兼容接口即可（`aiService.js` 里标了 TODO 位置）。
按导师意见，AI 月报属后期可选增强，先保留接口与提示词，待真实用户确认需求再接入。

## 测试

```bash
npm run smoke      # 38 项 API 断言（登录/分摊/排班/反馈/授权对比/AI/权限边界）
npm run test:db    # 14 项列迁移断言（老库补列、幂等、老数据保留与回填）
```

smoke 关键断言：均摊 ¥100÷3 合计恰为 10000 分、按比例 3:1:1 权重 3 者承担 60%、
指定金额不符 400、授权样本不足 409、对比结果搜不到寝室真名、
未授权寝室金额不进入公开对比、撤回授权后从池中移除、非本寝请求 AI 报告 403。

## 数据库迁移说明

schema 变更后 `CREATE TABLE IF NOT EXISTS` **不会**给已存在的表补新列，
因此 `src/db/migrate.js` 用 `PRAGMA table_info` 做幂等 `ALTER TABLE`，服务启动时自动执行。
注意 SQLite 的 `ADD COLUMN` 不接受 `DEFAULT (datetime('now'))` 这类非恒定默认值——
此类列改为可空 + 回填（`updated_at` 回填为 `created_at`），新行由仓储层显式写入。

## 待办 (下一步)

- 正式微信 `jscode2session` 换 openid（替换 mock）
- 结算汇总：每人「已垫付 − 应付」净额 + 最少转账次数撮合
- AI 真实接入：按 `aiService.js` TODO 补 OpenAI 兼容调用（配置已在 `.env.example`）
- 反馈的前端录入界面 + 小程序端管理页
- 前端：微信小程序页面 + 调用以上 API
