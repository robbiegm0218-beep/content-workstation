# 内容生产 Skill 插件化与市场上架计划

> 制定日期：2026-08-17
>
> 当前阶段：M5 本地市场材料已完成；待账号所有者上线公开页面并完成开发者权限检查后，才能进入 M6
>
> 状态说明：`[x] 已完成`、`[~] 进行中`、`[ ] 待开始`、`[!] 外部依赖`

## 1. 目标

把仓库中的 `content-workstation-creator` 从“内容工作站内部执行 Skill”演进为普通用户也能独立安装和使用的 Skills-only 插件，同时保持现有内容工作站的 Codex、HTML、封面、发布包和视频方案链路可用。

最终形成两个相互衔接但边界清楚的产品：

- **创作者内容生产插件**：安装到 Codex 或 ChatGPT 后，通过自然语言完成内容策划、视觉方案和发布包装。
- **内容工作站**：继续负责项目管理、内容库、状态流转、数据复盘、Remotion 渲染、ZIP 导出和本地文件维护。

第一版插件暂定标识为 `creator-content-studio`。正式创建清单前可调整用户可见名称，但目录名、`plugin.json` 名称和市场条目名称必须保持一致。

## 2. 官方规范约束

- 每个插件必须包含 `.codex-plugin/plugin.json`。
- 第一版只包含 Skills，不配置 MCP、`.app.json`、远程服务或用户认证。
- 一个 Skill 聚焦一个可识别目标；复杂规则通过 `references/` 渐进加载。
- 插件需要在本地市场安装后使用新任务进行触发、输出和失败回退测试。
- 公开提交前需要准备商店文案、Logo、网站、支持地址、隐私政策、服务条款、测试用例和发布说明。
- 不承诺当前运行环境无法保证的能力；没有生图能力时提供封面设计稿，没有本地渲染环境时只提供视频场景方案。

官方依据：

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/build/skills
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/app-guidelines

## 3. 产品边界

### 3.1 插件 V1 包含

1. 账号定位和内容目标信息采集。
2. 选题判断、三个差异化切入角度和推荐角度。
3. 5～8 分钟口播稿、混合录制稿、时间轴和素材清单。
4. 已确认内容基础上的单文件 HTML 录屏页。
5. 16:9、4:3、3:4 三尺寸封面策划；环境支持时生成封面文件。
6. 按用户实际选择的平台生成发布文案。
7. 直接内容视频或基于 HTML 演化视频的可编辑场景方案。
8. 缺少真实案例时列出待补充问题，不虚构经历、项目、客户、指标和效果。

### 3.2 插件 V1 不包含

- 内容库、历史数据和工作台状态管理。
- 浏览器 `localStorage`、数据库、仪表盘和数据复盘。
- Codex Local Bridge 的启动和端口管理。
- Remotion Studio、MP4 渲染和 FFmpeg 环境安装。
- ZIP 打包和文件下载中心。
- 自动发布到 B站、小红书、视频号或抖音。
- ChatCut 或其他第三方剪辑软件控制。

这些能力继续由内容工作站承担，防止市场插件描述与实际可用能力不一致。

## 4. 目标目录结构

```text
self-media-studio/
├── plugins/
│   └── creator-content-studio/
│       ├── .codex-plugin/
│       │   └── plugin.json
│       ├── assets/
│       │   ├── icon.png
│       │   ├── logo.png
│       │   └── screenshots/
│       └── skills/
│           ├── create-creator-content/
│           │   ├── SKILL.md
│           │   ├── agents/openai.yaml
│           │   ├── references/
│           │   └── assets/
│           ├── produce-creator-visuals/
│           │   ├── SKILL.md
│           │   ├── agents/openai.yaml
│           │   ├── references/
│           │   └── assets/
│           └── plan-creator-video/
│               ├── SKILL.md
│               ├── agents/openai.yaml
│               └── references/
├── .agents/
│   └── plugins/
│       └── marketplace.json
└── tests/
    └── plugin/
        ├── fixtures/
        └── *.test.mjs
```

### Skill 职责

| Skill | 触发目标 | 主要输出 |
|---|---|---|
| `create-creator-content` | 从选题、观点、账号资料生成或修改内容 | 三个角度、口播稿、时间轴、素材清单、已选平台发布包 |
| `produce-creator-visuals` | 从已确认内容制作 HTML 或封面 | 单文件 HTML、封面设计稿或三尺寸图片、产物说明 |
| `plan-creator-video` | 从已确认内容或 HTML 规划动态视频 | 可编辑场景方案、字幕、素材引用和缺失素材清单 |

## 5. 双入口兼容设计

公开 Skills 必须同时支持两种调用方式，但不能把两种协议混在同一次输出中。

### 5.1 普通用户对话入口

用户直接描述账号、选题和目标。Skill 应：

1. 使用已提供的信息先工作。
2. 只有缺少的信息会实质改变结论时才提出少量问题。
3. 默认返回便于阅读和编辑的 Markdown。
4. 用户明确要求生成文件时，才创建 HTML、图片或 Markdown 文件。
5. 用户没有指定平台时，先提供通用内容，不擅自生成“四平台发布包”。

### 5.2 内容工作站结构化入口

调用方提供输入文件、输出目录和 JSON Schema。Skill 应：

1. 严格读取指定输入，不访问无关个人文件。
2. 严格输出 Schema 要求的 JSON 或文件 manifest。
3. 保留现有事实边界、确认门槛和产物校验规则。
4. 工作站专用的 `skillEvidence` 由 Bridge 适配层维护，不作为公开用户输出要求。

## 6. 可执行任务

### M0：现状审计与方案冻结

| 编号 | 状态 | 任务 | 交付物 / 验收标准 |
|---|---|---|---|
| P01 | [x] | 核验官方插件和提交规范 | 已确认 Skills-only 插件可行，公共插件必须包含 manifest |
| P02 | [x] | 审计现有 Skill 和隐私边界 | Skill 校验通过；隐私扫描通过；识别工作站输入协议耦合点 |
| P03 | [x] | 冻结 V1 产品边界 | 本计划明确插件能力、工作站能力和非目标 |

### M1：建立本地可安装插件骨架

目标：不修改当前 Bridge 的生产调用，先让新插件能被 Codex 独立安装和发现。

| 编号 | 状态 | 任务 | 修改位置 | 验收标准 |
|---|---|---|---|---|
| P04 | [x] | 创建插件目录和基础清单 | `plugins/creator-content-studio/.codex-plugin/plugin.json` | manifest 通过官方本地 validator |
| P05 | [x] | 创建仓库本地市场条目 | `.agents/plugins/marketplace.json` | Codex 能从该市场发现并安装插件 |
| P06 | [x] | 建立三个 Skill 空骨架 | `plugins/.../skills/*` | 每个 Skill 包含合规 `SKILL.md` 和 `agents/openai.yaml` |
| P07 | [x] | 增加最小品牌资源 | `plugins/.../assets/` | Logo/Icon 文件存在且 manifest 引用有效 |
| P08 | [x] | 增加插件校验命令 | `package.json`、`scripts/validate-content-plugin.mjs` | `npm run plugin:validate` 一条命令返回通过 |
| P09 | [x] | 本地安装冒烟 | 本地 Codex 新任务 | 三个显式 `$skill-name` 调用均能触发，不影响旧 Skill |

M1 闸门：插件可安装、可发现、可卸载；现有 `npm run doctor`、Bridge 和内容工作站测试仍通过。

M1 验证记录（2026-08-17）：

- 工作分支：`codex/creator-content-studio-plugin`。
- 插件以 `creator-content-studio@personal` 安装并显示为 `installed, enabled`，来源保持为当前仓库插件目录。
- 三个 Skills 均通过 `quick_validate.py`，插件通过官方 `validate_plugin.py` 和仓库 `npm run plugin:validate`。
- 新的临时 Codex 任务从安装缓存逐一加载三个 Skills；测试只选择 B站，最终结果只包含 B站。
- 未修改旧 `content-workstation-creator`、Bridge、Schema、前端页面和本地业务数据。
- ESLint、生产构建、51 项应用与 Bridge 测试、隐私扫描全部通过。

### M2：公开化改造

目标：让没有内容工作站、没有 JSON Schema 的普通用户也能完成一次端到端内容生产。

| 编号 | 状态 | 任务 | 修改位置 | 验收标准 |
|---|---|---|---|---|
| P10 | [x] | 抽取内容生产公共规则 | `create-creator-content/SKILL.md` 与 `references/` | 支持对话输入和结构化输入；不要求仓库专用文件 |
| P11 | [x] | 改造事实与案例边界 | 内容规则 reference | 缺少案例时输出问题，不生成虚构经历或指标 |
| P12 | [x] | 按平台选择动态生成发布包 | 内容 Skill | 选择一个平台时只生成一个平台，不默认四平台 |
| P13 | [x] | 抽取 HTML 和封面能力 | `produce-creator-visuals` | 只有已确认内容才能进入视觉生产；无生图工具时明确降级 |
| P14 | [x] | 抽取视频场景规划能力 | `plan-creator-video` | 支持 `direct-content` 与 `accepted-html`，不承诺渲染 MP4 |
| P15 | [x] | 删除公开版内部标记 | 三个公开 Skill | 不暴露 `CW-SKILL-1.0`、Bridge 路径或内部状态字段 |
| P16 | [x] | 优化触发描述和默认提示 | 三个 `SKILL.md`、`agents/openai.yaml` | 直接、间接和不完整请求可触发；无关任务不触发 |
| P17 | [x] | 建立统一输出降级说明 | 各 Skill reference | 缺浏览器、搜索、生图、文件写入时给出真实且可继续的替代结果 |

M2 闸门：在一个空目录和全新 Codex 任务中，只提供自然语言选题即可生成可用内容；不需要启动内容工作站。

M2 验证记录（2026-08-17）：

- 插件更新并重新安装为 `0.1.0+codex.20260817060918`。
- 空目录、无 Git、无工作站、未显式写 Skill 名的内容请求成功触发内容 Skill。
- 自然语言输入生成三个切入角度并推荐一个；只选择 B站时只生成 B站内容。
- 用户仅声明“有真实案例”时，结果没有虚构经历，列出角色、争议、行动、结果和公开边界等待补充问题。
- 视觉与视频请求自动加载两个对应 Skills；在禁用生图、写文件和渲染时，返回 HTML 规划、三尺寸独立封面构图和 direct-content 场景方案，并明确哪些文件没有生成。
- 结构化模式严格返回 Schema JSON，只包含一个已选平台和真实案例问题，没有 Markdown 包装。
- 普通 React 问题没有读取或调用本插件的任何 Skill，负向触发通过。
- 公开插件静态校验新增内部标记、本机路径、密钥形状、所需 references 和起始提示词约束。

### M3：兼容内容工作站并消除重复维护

目标：插件成为公共规则源，工作站只保留结构化适配，不长期维护两套冲突规则。

| 编号 | 状态 | 任务 | 修改位置 | 验收标准 |
|---|---|---|---|---|
| P18 | [x] | 建立工作站任务到三个 Skills 的路由映射 | `bridge/task-definition.mjs` | content/angles/publishing/html/cover/video-plan 路由正确 |
| P19 | [x] | 调整隔离工作区复制逻辑 | `bridge/workspace-manager.mjs` | 只复制任务需要的插件 Skill 和输入文件 |
| P20 | [x] | 将内部 evidence 移到适配层 | Bridge、schemas、validators | 前端状态判断不再依赖 Skill 文案主动写固定标记 |
| P21 | [x] | 迁移现有冒烟测试 | `scripts/smoke-codex-*.mjs`、`tests/bridge/` | 旧任务类型全部通过新 Skills 生成 |
| P22 | [x] | 移除旧仓库 Skill | `.agents/skills/content-workstation-creator` | 仅在新链路全量通过后删除；Git 历史可回退 |
| P23 | [x] | 更新 Doctor 和 README | `bridge/doctor.mjs`、`README.md` | 诊断插件安装状态，安装步骤明确到终端和设置页 |

M3 闸门：内容工作站完整链路、真实 Codex 冒烟、HTML、封面、发布包、视频方案和续跑修改全部通过；没有两套同义规则。

M3 验证记录（2026-08-17）：

- `research`、`angles`、`content`、`publishing` 路由到 `create-creator-content`；`html`、`cover` 路由到 `produce-creator-visuals`；`video-plan` 路由到 `plan-creator-video`。
- 隔离工作区只复制当前任务需要的一个 Skill 和一个 Schema；`video-render` 不复制 Codex Skill。
- 公共 Schema 不再要求 `CW-SKILL-1.0`。Bridge 适配器在验证并落盘前注入 `CW-BRIDGE-1.0`，工作站内部结果保持可追踪。
- 旧 `.agents/skills/content-workstation-creator` 已在第一轮 54/54 回归通过后删除；代码和运行时不再维护第二套同义规则。
- 真实 Codex 内容任务通过：加载 `create-creator-content`，生成 3 个副标题候选和 8 段时间轴。
- 真实 HTML 任务通过：生成单文件 HTML，磁盘 manifest、根节点标记、远程资源限制和 SHA-256 校验通过。
- 真实封面任务通过：使用 `codex-imagegen-hybrid` 生成 1600×900、1200×900、900×1200 三张独立 PNG，尺寸与 SHA-256 校验通过。
- 真实 Bridge 内容生成和同线程续跑通过：两次运行使用同一 thread，适配层 evidence 为 `CW-BRIDGE-1.0`。
- 发布包和视频方案通过路由、Schema、单平台约束、场景语义和 Bridge 固定测试。
- 2026-08-20 补跑真实 Codex 发布包任务通过：仅为已选 B站生成 `publishing-package.md`，Manifest、SHA-256 和 `CW-BRIDGE-1.0` evidence 校验通过。
- 2026-08-20 补跑真实 Codex 视频方案任务通过：通过 `plan-creator-video` 路由生成 `video-scene-plan.json`，场景 Schema、连续帧时长、Manifest 与 SHA-256 校验通过。
- Doctor 可区分插件源码与 Codex 安装状态；README 和首次使用向导给出终端、浏览器和设置页的明确操作位置。

### M4：测试与质量闸门

| 编号 | 状态 | 任务 | 交付物 / 验收标准 |
|---|---|---|---|
| P24 | [x] | 建立 5 个正向市场测试 | `tests/plugin/positive-cases.json` | 覆盖内容、案例不足、HTML、封面、单平台发布和视频方案中的至少五类 |
| P25 | [x] | 建立 3 个负向触发测试 | `tests/plugin/negative-cases.json` | 编程、纯视频剪辑、内容库开发等无关请求不触发 |
| P26 | [x] | 建立边界测试 | `tests/plugin/edge-cases.json` | 覆盖无搜索、无生图、无写权限、未确认内容和输入冲突 |
| P27 | [x] | 建立结构与隐私扫描 | CI、现有 `check:privacy` | 无密钥、个人路径、认证文件、真实私人案例和未授权素材 |
| P28 | [x] | 新任务前向测试 | Codex 新任务测试记录 | 每个 Skill 至少进行一次无上下文泄漏的真实调用 |
| P29 | [x] | 全仓回归 | npm scripts | lint、build、unit、bridge、plugin validate、privacy 全部通过 |

建议正向用例：

1. 只有账号定位和一个选题，生成 5～8 分钟内容稿。
2. 用户声称有案例但未给细节，生成待补充问题且不虚构。
3. 从已确认内容生成单文件 HTML。
4. 生成三尺寸封面；没有图片工具时返回可执行封面设计稿。
5. 只选择 B站时只生成 B站发布包。
6. 从内容或已确认 HTML 生成视频场景方案。

建议负向用例：

1. “修复这个 React 页面报错”不触发内容生产插件。
2. “把这段 MP4 去掉停顿并调色”不触发，交给视频剪辑能力。
3. “给内容工作站增加用户登录和云数据库”不触发，作为软件开发任务处理。

M4 闸门：插件 validator、Skill validator、所有自动测试和人工触发测试均通过，且失败路径不会伪装成成功。

M4 验证记录（2026-08-20）：

- 固定市场用例包含 6 个正向能力、3 个负向触发和 5 个能力边界，并由 `npm run test:plugin` 在 CI 中执行。
- 正向覆盖内容稿、案例不足、单文件 HTML、三尺寸封面降级、B站单平台发布包和可编辑视频方案。
- 负向覆盖 React 调试、MP4 剪辑调色和内容库软件开发；真实 React 请求未读取任何插件 Skill。
- 边界覆盖无搜索、无生图、无写权限、内容未确认和输入冲突，都要求返回真实降级或停止信息。
- `create-creator-content`、`produce-creator-visuals`、`plan-creator-video` 均在全新隔离 Git 目录中完成一次真实 Codex 调用，没有复用线程或个人账号资料。
- 真实降级验证通过：案例不足时列待补充问题；无生图和写权限时返回三尺寸构图且不声称 PNG 存在；视频方案不声称已渲染 MP4。

### M5：公共市场材料

| 编号 | 状态 | 任务 | 交付物 / 验收标准 |
|---|---|---|---|
| P30 | [x] | 确定正式品牌名称与开发者名称 | manifest、商店资料 | 名称清晰、非通用占位、不暗示 OpenAI 官方背书 |
| P31 | [x] | 制作 Logo 和市场截图 | `plugins/.../assets/` | 浅色/深色可读，截图只使用通用示例数据 |
| P32 | [x] | 编写商店短描述、长描述和起始提示词 | `plugin.json`、提交材料 | 与实际能力一致，起始提示不超过平台限制 |
| P33 | [!] | 准备官网与支持地址 | 公共 HTTPS 页面 | 用户可访问，包含使用说明和联系方式 |
| P34 | [!] | 准备隐私政策和服务条款 | 公共 HTTPS 页面 | 说明数据处理、文件访问、第三方能力和责任边界 |
| P35 | [x] | 整理测试证据和版本说明 | `submission/` 或外部提交表单资料 | 5 正向、3 负向、可用地区、release notes 完整 |
| P36 | [!] | 完成开发者身份和权限检查 | OpenAI 组织设置 | 具备提交所需身份验证与管理权限 |

M5 闸门：公开资料中的每项能力都能由测试证据支撑；政策页面与插件实际数据行为一致。

M5 本地验证记录（2026-08-20）：

- 公开品牌确定为“创作者内容工作室 / Creator Content Studio”，开发者名称为“Content Workstation”，不含 OpenAI 官方背书表述。
- 浅色、深色 Logo 和 3 张 1440×900 市场截图已完成视觉检查，截图只使用通用 RAG 示例。
- manifest 已补齐品牌、能力边界、三条起始提示词、深色 Logo、市场截图和 HTTPS 政策地址。
- `docs/` 已准备官网、支持页、隐私政策和服务条款；GitHub Pages 工作流已准备，需合并到 `main` 并由仓库所有者启用 Pages 后才能标记 P33/P34 完成。
- GitHub 账号状态已只读核实：仓库为 Public，默认分支是 `main`，Issues 已开启；Pages API 返回未配置，因此政策 URL 尚未标记为可用。
- `submission/` 已包含市场文案、M4 测试证据、0.1.0 候选版说明和账号所有者检查表。
- 插件已按规范更新 cachebuster 并从仓库 `personal` marketplace 重新安装。
- P36 需账号所有者在 OpenAI/Codex 开发者设置中完成身份、组织与发布权限检查，Codex 不代替用户确认该外部状态。

### M6：提交、反馈与发布

| 编号 | 状态 | 任务 | 交付物 / 验收标准 |
|---|---|---|---|
| P37 | [ ] | 创建候选版本标签 | Git tag / release | 候选包与验证通过的 commit 一致 |
| P38 | [!] | 提交公共插件目录审核 | OpenAI 提交入口 | 提交成功并保存审核编号 |
| P39 | [ ] | 修复审核反馈 | 插件和提交材料 | 每条反馈有修改和回归验证记录 |
| P40 | [!] | 发布正式版本 | 公共插件目录 | 安装页可见，新用户完成首条内容测试 |
| P41 | [ ] | 建立版本维护规则 | 仓库计划与 release notes | Skill 行为变更、插件版本和工作站兼容关系可追踪 |

## 7. 验收命令规划

实现阶段应补齐以下统一入口；命令名在 M1 中落地：

```bash
# 校验三个 Skills
npm run plugin:validate:skills

# 校验 plugin.json 与插件资源
npm run plugin:validate

# 执行无需模型额度的固定测试
npm run test:plugin

# 本机显式执行真实 Codex 冒烟
npm run test:plugin:codex

# 回归内容工作站
npm run check:privacy
npm run lint
npm test
```

真实 Codex 冒烟不得放入默认 CI，避免消耗用户额度；CI 使用固定输入和 Fake Runner 验证路由、Schema、文件边界和降级逻辑。

## 8. 实施顺序与停止条件

严格按照 `M1 → M2 → M3 → M4 → M5 → M6` 执行，不提前删除旧 Skill。

每个阶段完成后：

1. 更新本文件任务状态和验证记录。
2. 运行该阶段闸门命令。
3. 查看 Git diff，确保没有混入个人数据或无关修改。
4. 单独提交一个可回退的 commit。
5. 只有前一阶段通过后才进入下一阶段。

遇到以下情况停止进入下一阶段：

- 新插件导致现有工作站任务失败。
- 普通用户必须理解 Bridge、Schema 或内部目录才能使用。
- 无生图或无搜索能力时没有明确降级路径。
- 插件声称生成了不存在的 HTML、图片或视频文件。
- 测试或截图包含个人账号资料、API Key、本机路径或未授权素材。
- 官网、隐私政策、服务条款或开发者验证尚未完成，却准备提交公共审核。

## 9. 工作量判断

按 Codex 可独立执行的开发批次计算：

| 阶段 | 预计批次 | 难度 | 主要风险 |
|---|---:|---|---|
| M1 本地插件骨架 | 1 | 低 | manifest 和市场路径配置 |
| M2 公开化改造 | 2～3 | 中 | 对话入口与结构化入口冲突、Skill 过宽 |
| M3 工作站迁移 | 2～3 | 中高 | Bridge、Schema、旧 evidence 和回归链路 |
| M4 测试闸门 | 1～2 | 中 | 真实触发测试的稳定性和环境差异 |
| M5 市场材料 | 1～2 | 中 | 品牌、政策 URL、个人身份和素材版权 |
| M6 提交发布 | 1+审核反馈 | 外部依赖 | 审核周期与反馈内容不可预估 |

预计完成“本地可安装公开版插件”需要 M1～M4，共 6～9 个 Codex 开发批次。官方上架还需要 M5～M6，其中官网、政策、身份验证和审核属于用户或外部平台依赖。

## 10. 下一步

下一批次执行 M4 的 P24～P29：把正向、负向和边界案例固化为插件测试数据，补齐统一 `test:plugin` 入口，并完成公开插件的质量与隐私闸门。
