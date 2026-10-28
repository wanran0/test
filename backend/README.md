# 宿舍生活分摊工具 · 后端骨架

Node.js + Express + 内置 `node:sqlite`（零原生依赖，Node ≥ 22.5）。
本轮只做后端，微信小程序前端待下一轮。

## 运行

```bash
cd backend
npm install          # 仅装 express
npm start            # http://localhost:3000/api/health
# 开发热重载:
npm run dev          # node --watch
```

可选环境变量见 `.env.example`（用 `node --env-file=.env src/server.js` 加载）。
数据文件默认落在 `backend/data/app.db`（已 gitignore）。

## 分层结构

```
src/
  config.js              配置(端口/DB/密钥)
  server.js / app.js     入口 / Express 装配
  db/                    node:sqlite 连接、schema.sql、init
  models/                数据访问(repo)，SQL 只出现在这里
  services/              纯业务算法：分摊 split、排班 schedule
  controllers/           编排 repo+service，处理 HTTP 语义
  routes/                路由与中间件装配
  middleware/            鉴权 requireAuth/requireMember/requireInput、错误处理
  utils/                 money(整数分)、token(HMAC)、ids
```

## 核心模型（对应导师意见）

- 以 **寝室(dorm)** 为单位；创建者自动为 **宿舍长(dorm_head)**。
- **权限分离**：`dorm_member.can_input` / `can_edit`，默认宿舍长全权，支持指定不同人分管不同费用。
- **预置类别**：建寝即写入「电费/水费」两个 `is_preset` 类别，可追加自定义。
- **金额用整数分**：`amount_cents` / `share_cents`，杜绝浮点误差。
- **三种分摊**：`equal`(均摊) / `ratio`(按比例，如高功耗成员权重更高) / `designated`(直接指定每人金额)。
- **排班轮换**：`chore.rotation_members` 有序队列 + 取模生成 `chore_assignment`，支持 daily/weekly。
- **反馈通道**：`feedback` 表已占位（导师要求列出但暂未接前端）。

## API 一览

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | 模拟微信登录，返回 token | 公开 |
| POST | `/api/dorms` | 建寝(自动设宿舍长+预置水电) | 登录 |
| GET/POST | `/api/dorms/:dormId/members` | 成员列表 / 加人 | 成员 / 录入 |
| GET/POST | `/api/dorms/:dormId/categories` | 类别 / 追加自定义类别 | 成员 / 录入 |
| GET/POST | `/api/dorms/:dormId/expenses` | 账单列表 / 记账并算分摊 | 成员 / 录入 |
| GET/POST | `/api/dorms/:dormId/chores` | 值日项 / 建项并生成排班 | 成员 / 录入 |
| GET | `/api/expenses/:expenseId` | 单笔费用含各人应付 | 登录 |
| GET | `/api/chores/:choreId/schedule` | 某值日项排班 | 登录 |

## 冒烟测试

启动服务后另开终端：

```bash
npm run smoke     # 等价于 node scripts/smoke.mjs
```

覆盖 11 项断言：登录、建寝、宿舍长自动身份、预置水电类别、加室友与权限、
均摊/按比例/指定三种分摊（含「合计严格等于总额」的整数分校验）、
周排班轮换回环、无录入权限 403、未登录 401。可用 `BASE_URL` 指向别的地址。

## 待办 (下一步)

- 正式微信 `jscode2session` 换 openid（替换 mock）
- 结算汇总：每人「已垫付 − 应付」净额 + 最少转账次数撮合
- 全局统计分析接口（男女寝对比、逐月趋势）——普通统计即可，AI 月报为后期可选
- 前端：微信小程序页面 + 调用以上 API
