# 内容工作站 × Codex 本地直连实施计划

> 版本：v1.0
> 日期：2026-08-11
> 目标：第一阶段只完成当前使用者电脑上的端到端闭环；个人版验收稳定后，再进入 GitHub 用户本地连接 Codex 的分发阶段。
> 状态：A0～A8、B0～B2 已完成；GitHub 本地分发进入 B3（隐私扫描与干净目录克隆验收）

## 0. 开发阶段与优先级

### 阶段 A：个人本地版（当前唯一开发目标）

先在当前电脑、当前 Codex 登录、当前账号资料和当前内容生产流程下完成：

1. 工作站能够检测并连接当前本机 Codex；
2. 内容生成不再复制提示词和粘贴结果；
3. 内容稿自动回填、编辑、确认和保存版本；
4. Codex 生成 HTML、三尺寸封面和发布包；
5. 页面内查看进度、停止、重试和继续修改；
6. 重启工作站后仍能查看内容、任务和本地产物；
7. 完成一次真实选题的全链路验收。

阶段 A 对应 C01～C24。C01～C07 是技术闸门，C08～C24 是个人版正式开发。

### 阶段 B：GitHub 本地分发版（暂不开发）

只有阶段 A 通过真实内容验收后，才执行：

- 通用化仓库 Skill 与默认账号资料；
- 其他用户的 Codex 安装、登录和版本诊断；
- macOS / Windows 差异处理；
- Fake Runner 与不消耗 Codex 额度的 CI；
- 第二个干净目录克隆验收；
- 发布 Git 版本和使用文档。

阶段 B 对应 C25～C31。当前只保留设计和任务，不提前实现，避免个人流程尚未稳定就投入兼容工作。

## 1. 最终目标

用户不再复制提示词、切换到 Codex、再把结果粘贴回工作站。完整流程在内容工作站内完成：

```text
填写选题
  → 工作站启动本机 Codex
  → 页面内查看生成进度
  → 内容稿自动回填、编辑、确认
  → Codex 生成 HTML 和三尺寸封面
  → 页面内预览、继续修改
  → 自动整理发布包与本地交付目录
```

阶段 A 只支持当前个人电脑本地运行，不建设云端多用户、账号系统、远程任务队列、平台托管的 Codex 服务，也不为其他操作系统提前做兼容。

## 2. 已确认的技术基础

- 当前电脑已安装 Codex CLI，且已使用 ChatGPT 登录。
- `codex exec` 支持非交互执行、JSONL 事件、结构化输出、会话续跑和不同沙箱等级。
- 当前 Codex 环境已经启用图片生成能力。
- Codex 会扫描仓库根目录的 `.agents/skills`，因此通用 Skill 可以随 Git 仓库分发。
- 当前前端使用 vinext + Cloudflare Worker 兼容运行时，不能在 Worker 路由中直接创建本机子进程。

结论：保留现有前端，新增只监听本机的 Node.js Local Bridge，由它启动和管理 `codex exec`。

## 3. 总体架构

```text
浏览器：内容工作站（localhost:3000）
  │
  │ HTTP + NDJSON 流式事件
  ▼
Node.js Local Bridge（127.0.0.1:4317）
  │
  ├─ 环境诊断：Codex 安装、版本、登录、Skill、图片能力
  ├─ 任务管理：启动、取消、续跑、错误恢复
  ├─ 运行隔离：为每次任务创建独立工作目录
  ├─ 结果解析：消费 codex exec --json 事件
  └─ 产物服务：安全预览 HTML、图片和发布包
  │
  ▼
本机 Codex CLI
  ├─ 仓库级 Content Workstation Skill
  ├─ 内容生成
  ├─ HTML 文件生成与修改
  ├─ 图片生成
  └─ 文件审核与发布包整理
```

### 为什么第一版使用 `codex exec`，不直接上 App Server

- 当前机器已经具备可用的 Codex CLI 和登录状态。
- `codex exec --json` 已提供稳定的机器可读事件，足以完成第一版流式进度。
- App Server 的 WebSocket 仍属于实验接口，不作为本地产品第一版依赖。
- Bridge 内部保留 Runner 接口，后续可以将 CLI Runner 替换成 Codex SDK，而不修改页面协议。

## 4. 仓库目标目录

```text
self-media-studio/
├── .agents/
│   └── skills/
│       └── content-workstation-creator/
│           ├── SKILL.md
│           ├── references/
│           └── assets/
├── bridge/
│   ├── server.mjs
│   ├── doctor.mjs
│   ├── codex-runner.mjs
│   ├── run-manager.mjs
│   ├── artifact-server.mjs
│   ├── security.mjs
│   └── constants.mjs
├── schemas/
│   ├── content-result.schema.json
│   ├── artifact-manifest.schema.json
│   └── run-event.schema.json
├── app/
│   ├── components/
│   │   ├── codex-status.tsx
│   │   ├── generation-panel.tsx
│   │   ├── run-progress.tsx
│   │   └── artifact-preview.tsx
│   └── lib/
│       ├── local-bridge.ts
│       └── generation-types.ts
├── scripts/
│   ├── setup-local.mjs
│   └── smoke-codex.mjs
├── .data/                 # 本地运行数据，Git 忽略
│   ├── runs/
│   └── bridge.json
├── work/                  # Codex 临时工作区，Git 忽略
└── outputs/               # 最终交付物，Git 忽略
```

仓库 Skill 使用唯一名称 `content-workstation-creator`，避免与用户全局安装的同名 Skill 冲突。账号背景、案例、风格和目标不固化在公开 Skill 中，而是每次由工作站写入任务输入文件。

## 5. Local Bridge 接口

### 5.1 环境与诊断

#### `GET /v1/health`

返回 Bridge 是否启动、版本和当前任务数，不执行 Codex。

#### `POST /v1/doctor`

按顺序检查：

1. Node.js 版本满足项目要求；
2. `codex` 命令存在；
3. Codex 版本满足项目记录的最低验证版本；
4. `codex login status` 成功；
5. 仓库 Skill 可被发现；
6. 工作目录可创建；
7. 图片生成能力是否可用；
8. 3000 与 4317 端口是否可用。

返回每个检查项的 `pass / warn / fail`、修复建议和可复制命令。

### 5.2 任务

#### `POST /v1/runs`

创建内容、HTML、封面、发布包或修改任务，并以 NDJSON 持续返回事件。

请求核心字段：

```json
{
  "contentId": "content-xxx",
  "taskType": "content|html|cover|publishing|revise",
  "contentVersion": 3,
  "style": "专业科技",
  "instruction": "用户本次补充要求"
}
```

Bridge 不接受 Shell 命令、可执行文件路径或任意 Codex 参数。前端只能选择白名单任务类型。

#### `POST /v1/runs/:runId/cancel`

终止对应 Codex 子进程，等待退出后更新状态，不能遗留后台进程。

#### `POST /v1/runs/:runId/continue`

使用已保存的 `threadId` 执行 `codex exec resume <threadId>`，用于“第三屏文字太多”“人物留白更大”等连续修改。

#### `GET /v1/runs/:runId`

返回任务状态、耗时、Codex thread ID、最终摘要、错误和交付物清单。

### 5.3 产物

#### `GET /v1/artifacts/:runId/manifest`

返回经过 Schema 校验的产物清单。

#### `GET /v1/artifacts/:runId/file/:fileId`

只允许读取 manifest 已登记且位于该任务输出目录中的文件。禁止通过相对路径访问任意本机文件。

## 6. Codex 任务运行方式

### 6.1 任务隔离

每次任务创建独立目录：

```text
work/{runId}/
├── .git/                         # 独立临时 Git 仓库
├── .agents/skills/               # 从项目 Skill 复制
├── input/
│   ├── creator-context.json
│   ├── content-brief.json
│   ├── confirmed-content.md
│   └── task.json
└── output/
```

Bridge 在临时目录中初始化独立 Git 仓库。这样 `workspace-write` 只覆盖本次任务，不允许 Codex 修改内容工作站源码。

### 6.2 内容任务

- 沙箱：`read-only`
- 输出：结构化 JSON
- 页面行为：流式显示进度，最终自动回填内容编辑器
- 失败行为：保留当前内容，不覆盖已确认版本

示意命令：

```bash
codex exec \
  --json \
  --sandbox read-only \
  --output-schema schemas/content-result.schema.json \
  -C work/{runId} \
  "请使用 content-workstation-creator Skill 生成内容草稿"
```

Bridge 必须使用 `spawn(command, args)`，禁止把用户输入拼成 Shell 字符串。

### 6.3 HTML、封面和发布包任务

- 沙箱：`workspace-write`
- 输入：只提供已确认内容快照和风格配置
- 输出：仅写入任务目录的 `output/`
- 最终要求：生成 `manifest.json`

示意产物：

```text
outputs/{contentId}/{version}/
├── content.md
├── presentation.html
├── cover-16x9.png
├── cover-4x3.png
├── cover-3x4.png
├── publishing-package.md
└── manifest.json
```

### 6.4 封面降级方案

图片生成必须先通过技术验证。如果某台电脑的 Codex 无法稳定生成或落盘图片：

1. 仍由 Codex 生成三套独立 HTML/CSS 封面；
2. Bridge 使用本地浏览器渲染为 PNG；
3. 保持 16:9、4:3、3:4 独立布局，不机械裁切；
4. 页面明确标识“模板封面”，不伪装成图片模型结果。

该降级方案仍然只依赖 Codex，不引入 DeepSeek。

## 7. 页面流程改造

### 7.1 全局 Codex 状态

顶部增加：

- Codex 已连接 / 未安装 / 未登录 / Bridge 未启动；
- “重新检查”按钮；
- 首次使用引导；
- 当前运行任务数量。

### 7.2 新建内容

将“生成内容任务指令”替换为“使用 Codex 生成内容”。

点击后：

1. 自动保存内容项目；
2. 启动 Codex；
3. 当前页面显示阶段进度；
4. 完成后自动回填 Markdown；
5. 用户编辑并确认；
6. 不再出现复制提示词弹窗。

### 7.3 内容详情

每个阶段提供：

- 生成 / 停止 / 重试；
- 查看本次输入快照；
- 查看生成结果；
- 接受当前版本；
- 与上一版本比较；
- 继续修改；
- 打开本地产物目录。

### 7.4 HTML 与封面

- HTML 完成后直接在 iframe 中预览；
- 三张封面并列预览；
- 修改要求在工作站输入后继续同一 Codex thread；
- 只有用户点击“接受产物”才同步为完成状态。

## 8. 本地数据与版本

当前内容数据继续沿用浏览器本地保存，先不引入云数据库。

新增字段：

```text
ContentItem
- contentVersion
- acceptedRunId
- codexThreads
- artifactManifestPath
- latestRunStatus

RunRecord
- runId
- contentId
- taskType
- status
- threadId
- inputSnapshotHash
- startedAt
- completedAt
- errorCode
- artifactManifest
```

Bridge 将任务记录保存到 `.data/runs/{runId}/run.json`。页面刷新后通过 Bridge 恢复运行历史，不依赖内存状态。

## 9. 安全边界

- Bridge 只监听 `127.0.0.1`，禁止监听局域网地址。
- 只允许来自工作站本地域名的 JSON 请求。
- 启动时生成本地访问令牌，所有写接口必须携带令牌。
- 任务类型、Codex 参数、Schema 和工作目录全部由 Bridge 决定。
- 用户输入只作为任务内容，不进入 Shell 命令。
- 子进程继承最小环境变量，不向任务暴露无关密钥。
- 永不读取、复制或上传 `~/.codex/auth.json`。
- 不使用 `danger-full-access` 或跳过沙箱参数。
- 每个文件访问都校验真实路径仍在对应任务目录中。
- 任务超时、页面关闭和 Bridge 退出时都清理子进程。

## 10. GitHub 分发方案（阶段 B，个人版验收后执行）

### 仓库包含

- 内容工作站源码；
- Local Bridge；
- 通用仓库级 Skill；
- JSON Schema；
- 环境诊断脚本；
- 安装与排错说明；
- 假 Codex Runner，用于 CI 自动测试。

### 仓库不包含

- Codex 登录信息；
- 个人账号资料和历史内容；
- 生成的 HTML、图片和发布包；
- `.data/`、`work/`、`outputs/`；
- API Key 或本机绝对路径。

### 其他用户使用流程

```bash
git clone git@github.com:<your-account>/content-workstation.git
cd content-workstation
npm install
codex login
npm run doctor
npm run dev:local
```

首次进入页面后填写自己的账号背景、受众、风格和案例。仓库 Skill 读取这些动态上下文，不使用开发者的个人信息作为默认内容。

### 建议新增命令

```json
{
  "scripts": {
    "doctor": "node bridge/doctor.mjs",
    "dev:web": "现有 vinext dev 命令",
    "dev:bridge": "node --watch bridge/server.mjs",
    "dev:local": "同时启动 web 与 bridge",
    "start:bridge": "node bridge/server.mjs",
    "test:bridge": "node --test tests/bridge/*.test.mjs",
    "test:codex": "node scripts/smoke-codex.mjs"
  }
}
```

## 11. 可执行任务清单

状态说明：`[ ] 待开始`、`[~] 进行中`、`[x] 已完成`、`[!] 阻塞`。

### M0：技术闸门

| 编号 | 状态 | 任务 | 验收标准 |
|---|---|---|---|
| C01 | [x] | 建立最小 Codex Runner | Node 能启动 `codex exec --json` 并解析完成、失败和 thread ID |
| C02 | [x] | 验证仓库 Skill 加载 | 在临时 Git 工作区中明确调用仓库 Skill，输出符合预期规则 |
| C03 | [x] | 验证结构化内容输出 | 使用 JSON Schema 获得可自动回填的标题、稿件、时间轴和发布文案 |
| C04 | [x] | 验证 HTML 文件落盘 | Codex 仅在隔离目录生成可打开的单文件 HTML |
| C05 | [x] | 验证三尺寸图片落盘 | Codex 生成三张独立尺寸图片并在 manifest 中返回路径 |
| C06 | [x] | 验证取消和超时 | 可终止运行任务，进程退出且状态变为已取消或超时 |
| C07 | [x] | 形成技术验证报告 | 明确通过项、失败项、Codex 最低验证版本和封面是否启用降级方案 |

只有 C01～C06 全部有明确结论后，进入正式功能开发。

#### A0 技术验证记录（2026-08-11）

- 验证环境：macOS、Node.js 22.22.1、`codex-cli 0.146.0-alpha.9.2`，本机使用 ChatGPT 登录 Codex。
- C01：`bridge/codex-runner.mjs` 已通过 Node 单元测试；可解析被拆分的 JSONL、成功事件、失败事件和 `thread.started` 的 thread ID。真实调用获得 thread ID `019feedc-1091-77a3-b62a-29d9a6fb4382`。
- C02：冒烟脚本创建独立临时 Git 工作区，只复制 `.agents/skills/content-workstation-creator`、测试输入和 Schema。Codex 返回 Skill 专属标记 `CW-SKILL-1.0`，证明仓库 Skill 已加载并执行。
- C03：`--output-schema` 和 `--output-last-message` 已真实通过。结果可解析为 JSON，包含 3 个副标题候选、推荐副标题、口播稿、9 段时间轴、素材建议、待补案例问题和四平台发布包。
- 自动校验：Skill `quick_validate.py` 通过；ESLint 通过；完整构建与 5 项测试通过。
- 本地验证产物位于忽略提交的 `work/a0-smoke/`。仓库不保存真实生成稿、Codex 状态或个人密钥。
- 阶段结论：A0 通过。技术闸门整体仍为进行中，下一批只执行 A1（C04～C07），验证 HTML、三尺寸封面、取消/超时并给出 Go / Conditional Go / No-Go 结论。

#### A1 技术验证记录（2026-08-11）

- C04：真实 Codex 任务在隔离 Git 工作区生成 `output/presentation.html`。文件为无外部请求的单文件页面，包含仓库 Skill 页面标记，manifest 哈希与实际文件一致；已用本机 Chrome 打开并完成首屏视觉检查。
- C05：真实 Codex 任务成功调用 imagegen 生成 1536 × 1024 无字视觉素材，再分别排版为 1600 × 900、1200 × 900、900 × 1200 三张 PNG。三张图像通过签名、实际像素、文件哈希、路径边界和独立构图检查，运行模式为 `codex-imagegen-hybrid`。
- C06：Runner 支持 `AbortSignal`、超时、SIGTERM 和超时后的 SIGKILL 兜底；单元测试覆盖取消和超时。真实 Codex 取消测试获得 thread ID `019feee5-8670-7862-8039-92246c428dbf`，退出后 PID 21922 不再存活。
- C07：完整报告见 [CODEX_TECHNICAL_GATE_REPORT.md](./CODEX_TECHNICAL_GATE_REPORT.md)。当前个人本机结论为 **Go**；最低已验证版本为 `codex-cli 0.146.0-alpha.9.2`，不是对更低版本兼容性的承诺。
- 自动校验：Skill 校验通过，ESLint 通过，应用构建通过，9 项测试通过。`work/`、`outputs/`、`.data/` 已从 Git 和源码 lint 范围排除。
- 封面策略：本机不强制降级，默认采用 imagegen 无字视觉素材加本地精确排版；仍保留 `codex-template-render` 自动降级，以应对其他机器的权限、额度或图片能力差异。
- 技术闸门结论：C01～C07 全部通过，可以进入 A2（C08～C13）的 Local Bridge 正式开发。

### M1：Local Bridge

| 编号 | 状态 | 任务 | 验收标准 |
|---|---|---|---|
| C08 | [x] | 建立 Bridge 服务 | 只监听 127.0.0.1:4317，健康检查可用 |
| C09 | [x] | 开发 Doctor | 能识别未安装、未登录、Skill 缺失、版本不兼容和图片不可用 |
| C10 | [x] | 建立隔离工作区 | 每个任务拥有独立临时 Git 仓库和输入输出目录 |
| C11 | [x] | 开发任务管理器 | 支持启动、流式事件、取消、超时和状态恢复 |
| C12 | [x] | 开发任务记录 | Bridge 重启后仍能读取历史任务和产物 manifest |
| C13 | [x] | 加固本地安全 | Origin、令牌、参数白名单、路径校验和最小环境变量通过测试 |

#### A2 Local Bridge 验证记录（2026-08-11）

- C08：`npm run start:bridge` 已真实监听 `127.0.0.1:4317`；`GET /v1/health` 返回版本、固定 host、端口和活动任务数，停止后端口无残留监听。
- C09：`npm run doctor` 在本机返回 `overall: pass`。检查覆盖 Node、Codex 安装与版本、ChatGPT 登录、仓库 Skill、工作区写入、imagegen、本地渲染器和 3000/4317 端口；负向测试覆盖未安装、未登录、Skill 缺失、旧版本和图片不可用。
- C10：每个新任务创建独立 Git 工作区，复制仓库 Skill 和固定 Schema，只写入结构化输入快照与 `output/`；前端请求不能提供本机路径。
- C11：任务状态支持 queued、running、completed、failed、cancelled、timeout、interrupted；Codex JSONL 转为持久化事件并由 SSE 重放/流式返回。取消、超时和启动竞态测试通过；`/continue` 已真实复用原 thread ID。
- C12：运行记录与 events JSONL 使用原子文件写入 `.data/runs/`；Bridge 初始化时把未完成任务恢复为 interrupted，完成任务的 manifest 和 artifact ID 重启后仍可读取。
- C13：服务固定回环地址；写接口要求随机 Bearer token；校验 Origin、2 MB 请求上限、字段与任务类型白名单；Codex 子进程只继承最小环境变量；产物下载只接受 manifest 登记 ID，并检查普通文件、真实路径和 `output/` 边界。
- 真实端到端：Bridge 创建内容任务 `run-c96c2f4b-7706-42dd-85cf-c967c0866d7b`，获得 thread `019fef12-ea26-7b31-9692-514e447f0752`、Skill 标记和持久化产物；续跑任务 `run-4cefbc6c-b76b-4534-8f4e-c2d4ccc62a81` 使用同一 thread 并完成。
- 阶段结论：A2 通过；A3 已完成内容生成、版本确认与“新建内容”页面接通。

### M2：内容生成闭环

| 编号 | 状态 | 任务 | 验收标准 |
|---|---|---|---|
| C14 | [x] | 创建通用仓库 Skill | Git 克隆后 Codex 可发现，且不包含个人资料 |
| C15 | [x] | 定义内容结果 Schema | 覆盖标题、口播稿、时间轴、素材、发布文案和待补问题 |
| C16 | [x] | 接入新建内容页 | 点击一次即可启动生成，页面内显示进度并自动回填 |
| C17 | [x] | 建立内容版本 | 重试不覆盖已确认内容，可接受或恢复历史版本 |
| C18 | [x] | 删除提示词复制主流程 | 正常流程不再要求打开 Codex 或粘贴结果 |

#### A3 内容生成闭环验证记录（2026-08-11）

- C14～C15：复用已经通过真实 Codex 技术闸门的仓库 Skill 与结构化内容 Schema；账号资料和选题只通过隔离任务输入传入。
- C16：新建内容与内容详情均可直接启动本机 Codex；页面显示连接、排队、运行、失败和停止状态，完成后从受控 artifact 接口读取结果并自动回填。
- C17：每次生成保存独立候选版本。未确认稿自动采用最新版本；已确认稿重新生成时保持原稿不变，由用户选择是否采用新版本。
- C18：内容生产主流程不再生成、复制或粘贴提示词；HTML 与封面仍保留原入口，等待 A4 直连改造。
- 本地连接：Bridge 新增仅允许工作站 Origin 获取的浏览器会话端点，后续写操作和产物读取仍需 Bearer token。

### M3：HTML、封面与发布包

| 编号 | 状态 | 任务 | 验收标准 |
|---|---|---|---|
| C19 | [x] | 接入 HTML 生成 | 只读取已确认内容，生成后在页面直接预览 |
| C20 | [x] | 接入封面生成 | 生成 16:9、4:3、3:4 三个文件并直接预览 |
| C21 | [x] | 实现封面降级渲染 | 图片工具不可用时仍能输出三张 Codex 设计的模板封面 |
| C22 | [x] | 支持继续修改 | 对 HTML 和封面的补充要求复用原 thread，不从头生成 |
| C23 | [x] | 生成发布包 | 基于确认稿和已验收视觉资产输出四平台 Markdown 与 manifest |
| C24 | [x] | 状态真实同步 | 只有实际文件存在且通过校验，阶段状态才显示完成 |

#### A4 HTML 与封面直连验证记录（2026-08-11）

- C19：HTML 任务只接收已确认内容快照和页面风格配置；完成后通过 manifest 登记文件读取，并在工作站 iframe 中预览。
- C20：封面任务读取已确认标题、稿件与封面风格，返回 16:9、4:3、3:4 三个独立 PNG；工作站通过授权 artifact 接口加载三张预览图。
- C21：仓库 Skill 保留 `codex-template-render` 降级路径；页面读取 `generationMode`，明确提示本次是图片混合生成还是模板降级，不伪装图片能力成功。
- 验收关卡：任务完成只进入“等待验收”，用户点击“接受这版产物”后才将对应 HTML 或封面状态设为已生成。
- 主流程已删除 HTML 和封面提示词复制弹窗；当前三个生产阶段均由页面直接调用本机 Codex。

#### A5 续跑修改、发布包与真实状态验证记录（2026-08-11）

- C22：HTML、封面和发布包均可填写修改要求，通过原任务保存的 `threadId` 续跑；新版本回到等待验收，不直接覆盖已接受产物。
- C23：发布任务读取已确认内容、平台列表、账号表达信息和已接受资产清单，输出 `publishing-package.md`；页面支持正文预览与 Markdown 下载。
- C24：Bridge 对发布包执行路径、MIME、哈希、manifest 和四个平台段落校验。页面只有在产物通过 Bridge 校验且用户点击接受后，才显示“已生成”并进入待录制。
- 仓库 Skill 已增加独立发布包生产规范并通过 `quick_validate.py`；应用构建和 19 项自动测试全部通过。
- 阶段结论：A5 通过；个人版功能开发已覆盖 C01～C24，下一步使用一条真实选题完成 A6 全链路人工验收。

#### A6 真实选题全链路验收记录（2026-08-11）

- 使用“RAG后台的流转：从数据接入到评测上线的完整链路”完成真实生产：内容稿生成并确认，HTML 续跑去除无来源示例数字，形成 10 屏录屏页面。
- 三尺寸封面完成一次原任务续改，采用“RAG后台 6道质量关 / 从数据接入到评测上线”的短标题方案；当前版本按暂定可用验收，原 thread 保留用于后续视觉调整。
- 四平台发布包已在原任务中修正封面风格和文案映射，Markdown 下载文件通过 MIME、大小、哈希和 manifest 一致性检查。
- Bridge 重启后恢复 7 条历史任务与全部产物；发布包重新下载哈希保持一致。
- 新浏览器会话暴露出仅依赖 `localStorage` 的恢复缺口，现已增加 Bridge 工作站状态存储；重新加载后可恢复 1 个真实内容项目、账号设置及 6/7 已完成生产节点。
- 阶段结论：A6 通过，阶段 A 个人本地版完成。正式发布前只需人工校准视频实际时间点、平台预览和最终封面，不构成技术阻塞。

#### A7 统一 Codex 选题角度收口（2026-08-11）

- 选题推荐新增独立 `angles` 任务类型，与内容稿、HTML、封面和发布包共用 Local Bridge、Codex 登录与仓库 Skill。
- 新增 `topic-angles.schema.json`，要求结果恰好包含三个差异明确的角度，并为每个角度返回受众痛点、核心判断、内容价值和待补证据。
- 页面支持排队、运行耗时、当前动作、停止和 Bridge 重启后的任务恢复；完成后自动回填三张角度卡片。
- 删除原 DeepSeek/OpenAI 服务端 API 与模型密钥配置；当前内容生产链路不再依赖第三方模型 API Key。
- 真实页面联调成功返回三条角度，账号经历引用符合输入边界，缺少案例信息时明确标记待补充；浏览器控制台无错误。
- Skill 校验、ESLint、生产构建、Bridge 集成测试和隐私扫描通过。
- 阶段结论：个人本地版的角度、内容、HTML、封面与发布包现已统一通过本机 Codex 执行，可以进入 M4 GitHub 本地分发。

#### A8 连接、联网调研与任务中心验收（2026-08-11）

- 设置页新增 Codex 连接中心，通过 Bridge Doctor 检测 Node.js、Codex CLI 版本与登录、仓库 Skill、隔离工作区、图片生成、渲染器、Web 与 Bridge 端口；不读取或展示认证文件。
- 新增白名单 `research` 任务与严格 `topic-research.schema.json`。Runner 仅为该任务启用 Codex `--search`，结果必须区分实际来源、访问限制、内容空白、推荐角度与人工补充步骤。
- 新增任务中心，统一展示六类生产任务及其运行、完成、失败、超时和中断状态；支持停止与按原输入创建全新重试任务。
- 真实页面调研“传统产品经理转型 AI 产品经理，如何判断自己真正缺的能力”成功完成：返回 6 条 B站直达样本；小红书与视频号无可核验公开样本时保持空列表；三个建议角度均带待补证据。
- 设置页 9 项连接检查全部通过，任务中心恢复 13 条历史记录；浏览器控制台无错误。ESLint、生产构建和 26 项自动测试通过。
- 阶段结论：个人本地版不再需要在选题调研与生产任务间复制提示词，已具备可诊断、可观察、可停止和可重试的完整本地 Codex 使用体验。

### M4：GitHub 本地分发（阶段 B，进行中）

| 编号 | 状态 | 任务 | 验收标准 |
|---|---|---|---|
| C25 | [x] | 增加一键本地启动命令 | `npm run dev:local` 同时启动前端和 Bridge |
| C26 | [x] | 编写首次使用引导 | 从安装 Codex、登录到生成第一条内容步骤完整 |
| C27 | [x] | 建立 Fake Runner 测试 | GitHub CI 不消耗 Codex 额度也能验证页面和 Bridge |
| C28 | [x] | 增加真实 Codex 冒烟测试 | 本地显式执行，验证 Skill、HTML 和封面关键链路 |
| C29 | [ ] | 清理隐私与本机路径 | Git 扫描不包含个人内容、认证文件、密钥和绝对路径 |
| C30 | [ ] | 新机器克隆验收 | 在第二个干净目录完成 clone → install → login → doctor → generate |
| C31 | [ ] | 发布版本 | 构建、测试通过后推送 main，并创建本地直连版本标签 |

#### B0～B1 通用首次设置与一键启动验收（2026-08-11）

- 仓库默认账号资料保持通用占位内容；新数据首次加载时自动打开三步向导，要求填写身份、经历、受众、风格和内容目标，个人资料只写入本机数据层。
- 新增 `npm run dev:local`，由一个 Node 启动器同时管理 Web 与 Codex Bridge；任何一项异常退出会停止另一项，SIGINT/SIGTERM 会清理两个进程组。
- 首次使用向导提供 `npm install`、Codex CLI 安装、`codex login`、`codex login status` 和一键启动命令，并可直接调用连接检测。
- `npm run doctor` 默认输出面向用户的逐项结果和处理方式；传入 `-- --json` 时保留机器可读格式。
- 真实进程验收确认一条命令可同时启动 3000 与 4317 服务；一次 Ctrl+C 后两个端口均释放。首次发现 Bridge 残留后已修正退出等待逻辑并复测通过。
- ESLint、生产构建及 27 项自动测试通过。阶段结论：C25、C26 完成，可以进入 B2。

#### B2 Fake Runner CI 与真实 Codex 冒烟入口验收（2026-08-11）

- 新增 GitHub Actions 工作流，使用只读仓库权限和 Node.js 22，在 push/PR 上执行 `npm ci` 与 `npm run test:ci`。
- CI 路径只运行现有 Fake Runner Bridge 集成测试，不安装 Codex、不读取登录状态、不调用图片生成，也不消耗真实 Codex 额度。
- 新增统一 `npm run smoke:codex -- <scope> --yes` 入口，支持 `content`、`html`、`cover`、`bridge`、`cancel` 和 `full`；未提供 `--yes` 时以退出码 2 拒绝执行。
- 真实入口执行前检查 Codex CLI 与 `codex login status`，错误时给出安装或登录命令；`cover/full` 在 README 中明确标注耗时与额度成本更高。
- 本地以与 GitHub 相同的 `npm run test:ci` 完成 lint、生产构建和 28 项测试。工作流测试确认 CI 文件不包含任何真实冒烟命令。
- 真实 `content` 冒烟成功，thread ID 为 `019ff0f3-2b46-7783-bf3a-3b500fd161ae`，获得 8 个 JSONL 事件、`CW-SKILL-1.0` 标记、3 个副标题候选和 9 个时间轴节点。
- 阶段结论：C27、C28 完成，可以进入 B3 的隐私扫描与干净目录克隆验收。

## 12. 测试策略

### 单元测试

- JSONL 分片、半行和异常事件解析；
- 任务状态机；
- 路径越界阻止；
- manifest Schema 校验；
- Codex 错误码映射；
- 取消和超时清理。

### 集成测试

- 使用 Fake Codex 二进制模拟慢速事件、失败、无效 JSON 和多文件产物；
- 前端断线后重新读取任务状态；
- Bridge 重启后恢复历史任务；
- 同一内容多个版本不互相覆盖。

### 真实冒烟测试

- 显式运行，不进入 GitHub CI；
- 消耗真实 Codex 额度前给出提示；
- 验证仓库 Skill、内容结构、HTML 文件、三尺寸封面和续跑修改。

## 13. Codex 执行成本与推进方式

本项目由 Codex 持续开发，不使用人日估算。开发成本用“Codex 工作批次 + 技术复杂度 + 外部验证次数”衡量。

一个工作批次包含：读取当前状态、实现一组强相关任务、运行自动验证、修复本批次问题、更新计划状态和交付可运行结果。批次数是当前规划，不是固定承诺；真实 Codex、图片工具或本地进程行为不符合预期时，以技术闸门结果调整。

### 阶段 A：个人本地版

| 批次 | 范围 | 复杂度 | 本批结束条件 |
|---|---|---|---|
| A0 | C01～C03：Runner、仓库 Skill、结构化稿件 | 中 | Node 能启动 Codex，Skill 生效，稿件 JSON 可解析 |
| A1 | C04～C07：HTML、三尺寸封面、取消、技术报告 | 高 | 文件真实落盘，取消无残留，明确 Go / Conditional Go / No-Go |
| A2 | C08～C13：Local Bridge、Doctor、隔离、安全、恢复 | 高 | Bridge 可稳定管理任务，重启可恢复，路径和参数测试通过 |
| A3 | C14～C18：内容生成自动回填与版本 | 中高 | 当前页面完成生成、编辑、确认、重试，不再复制提示词 |
| A4 | C19～C21：HTML、封面预览与降级 | 高 | HTML 和三张封面可直接预览，图片失败时可降级输出 |
| A5 | C22～C24：续跑修改、发布包、真实状态 | 高 | 同一 thread 可继续修改，交付目录完整，状态由真实文件驱动 |
| A6 | 个人真实内容全链路验收与修复 | 中高 | 使用一个真实选题走完整链路，重启后数据和文件仍存在 |
| A7 | 统一选题角度到本机 Codex | 中 | 三个角度结构化回填，不依赖第三方模型 API |
| A8 | 连接诊断、联网调研与任务中心 | 中高 | 设置可诊断、调研有真实来源、全部任务可追踪与重试 |

阶段 A 共完成 9 个 Codex 工作批次。A0～A8 的技术闸门、生产链路与个人本地体验均已验收。

### 阶段 B：GitHub 本地分发版

| 批次 | 范围 | 复杂度 | 启动条件 |
|---|---|---|---|
| B0 | 将个人配置抽离为通用首次设置 | 中 | A6 已通过 |
| B1 | C25～C26：一键启动、安装与诊断引导 | 中高 | 通用配置验证完成 |
| B2 | C27～C28：Fake Runner、CI、真实冒烟测试 | 高 | Bridge 接口稳定 |
| B3 | C29～C30：隐私扫描、第二目录克隆验收 | 中高 | 文档与脚本完成 |
| B4 | C31：构建、提交、推送和版本标签 | 中 | 全部 Git 分发验收通过 |

阶段 B 暂估 5 个 Codex 工作批次，但当前不执行，也不影响阶段 A 的个人使用交付。

### 需要用户参与的验证点

Codex 可以完成代码、自动测试、进程检查和文件验证；以下节点需要当前使用者参与体验判断：

1. A1：确认封面视觉是否达到可用标准；
2. A3：确认内容稿的编辑和确认流程是否顺手；
3. A4：确认 HTML 录屏页面和三尺寸封面质量；
4. A6：选择一个真实选题完成最终全链路验收。

## 14. 最终验收场景

### 个人电脑

1. 打开内容工作站，显示“Codex 已连接”；
2. 新建选题并点击生成；
3. 不离开页面即可看到进度和完整稿件；
4. 修改并确认稿件；
5. 选择 HTML 与封面风格；
6. 页面内得到 HTML 和三张封面预览；
7. 输入一次修改意见并续跑成功；
8. 导出完整发布包；
9. 重启应用后内容、任务和产物仍可访问。

### 其他 GitHub 用户（阶段 B 验收）

1. 克隆公开仓库；
2. 安装依赖并完成 `codex login`；
3. `npm run doctor` 给出全部通过或明确修复方法；
4. `npm run dev:local` 启动两个本地服务；
5. 填写自己的账号资料；
6. 使用仓库级 Skill 生成第一条内容、HTML 和封面；
7. 本地数据与产物不出现在 Git 状态中。

## 15. 开始开发时的执行顺序

第一轮只执行个人版 A0，对应 C01～C03。A0 完成后立即更新状态，再执行 A1 的 C04～C07，并形成 Go / Conditional Go / No-Go 结论。确认可继续后，依次执行 A2～A6。

在 A6 使用真实选题完成个人版验收之前，不执行阶段 B 的 C25～C31。每个工作批次结束后都必须更新本文件状态、验证记录、已知问题和下一批次输入，保证后续 Codex 可以从计划继续执行。
