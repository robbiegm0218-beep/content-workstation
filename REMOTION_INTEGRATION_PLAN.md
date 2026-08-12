# 内容工作站 × Remotion 视频生成实施计划

> 版本：v1.0
> 日期：2026-08-12
> 状态：V0 技术闸门已通过；下一阶段为 V1 Codex 场景方案
> 原则：保留现有 HTML 录屏功能；视频是可选下游产物，不把 HTML 变成强制中间步骤。

## 1. 目标

在现有“选题 → 内容稿 → HTML / 封面 → 发布包”链路中增加 Remotion 视频制作能力，使用户在内容稿确认后可以自主选择：

1. **仅 HTML**：生成静态 HTML 演示页，继续手工录屏和讲解。
2. **直接视频**：不生成 HTML，根据确认内容和视频风格生成 Remotion 场景方案并渲染视频。
3. **HTML + 视频**：先生成、编辑并确认 HTML，再把 HTML 的章节和视觉结构演化为 Remotion 视频。
4. **HTML 与视频分别生成**：两者并列存在，互不覆盖，都可进入最终交付包。

本阶段不替代真人出镜和剪映等后期工具。Remotion 优先承担结构化信息画面、字幕、重点文字、流程动画、素材编排和多尺寸导出。

## 2. 产品决策

### 2.1 新的制作路径

```text
已确认内容稿
├── HTML：不生成 / 生成 HTML
│   └── HTML 可独立验收、录屏和导出
└── 视频：不生成 / 直接生成 / 基于已验收 HTML 生成
    ├── 生成场景方案
    ├── 人工查看和编辑
    ├── 生成 Remotion 工程
    ├── Studio 预览
    └── 本地渲染 MP4
```

### 2.2 为什么拆成“场景方案”和“视频渲染”

- Codex 擅长把稿件、HTML 和录制结构转换为结构化场景。
- Remotion 擅长按确定数据稳定渲染，不需要每期重新生成一套 React 代码。
- 场景方案可查看、编辑、确认，避免一次生成 MP4 后才发现节奏和画面不合适。
- 修改文字、时长、转场或素材时，只需重新渲染，不必重新调用 Codex。

### 2.3 HTML 与视频的关系

- HTML 保留当前独立状态：`未开始 → 待生成 → 生成中 → 待验收 → 已生成`。
- 视频拥有独立状态，不跟随 HTML 自动完成。
- “基于 HTML 生成视频”必须依赖已验收 HTML。
- “直接生成视频”只依赖已确认内容稿，不依赖 HTML。
- 内容稿发生变化时，HTML、视频方案、视频工程和 MP4 均标记为待更新。
- HTML 风格变化只让“基于 HTML”的视频失效，不影响“直接生成”的视频。

## 3. 用户界面设计

### 3.1 新建内容

保留现有录制方式，同时增加“动态视频制作”配置：

- 是否需要 HTML：`需要 / 暂不需要`
- 是否需要动态视频：`需要 / 暂不需要`
- 视频生成依据：
  - `直接根据内容稿`（默认）
  - `基于已确认 HTML`
- 视频画幅：
  - `16:9 横版`
  - `9:16 竖版`
  - 后续支持同时生成两种
- 视频类型：
  - `知识卡片讲解`
  - `流程图演示`
  - `口播辅助画面`
  - `HTML 视觉演化`

录制方式与产物选择分开：选择“混合录制”不再隐式强制生成 HTML，用户可以自己决定使用 HTML 主体还是 Remotion 动态主体。

### 3.2 内容详情新增“动态视频”页签

展示五个步骤：

1. 视频来源与风格；
2. 场景方案；
3. 素材与音频；
4. Remotion 预览；
5. MP4 渲染与验收。

每一步显示状态、耗时、失败原因、停止、重试和继续修改入口。

### 3.3 场景编辑器 MVP

第一版不做复杂时间线拖拽，只提供结构化表单：

- 场景标题；
- 开始时间与持续时间；
- 场景类型；
- 主文案与强调词；
- 旁白片段；
- 素材引用；
- 转场类型；
- 是否显示字幕；
- 删除、上下移动、复制场景。

## 4. 数据模型

为 `ContentItem` 增加：

```ts
type VideoSource = "direct-content" | "accepted-html";
type VideoAspect = "16:9" | "9:16";
type VideoState = "未开始" | "待生成" | "生成中" | "待确认" | "待渲染" | "渲染中" | "待验收" | "已生成" | "失败";

interface VideoProduction {
  enabled: boolean;
  source: VideoSource;
  aspect: VideoAspect;
  style: string;
  scenePlanState: VideoState;
  scenePlanRunId: string;
  acceptedScenePlanVersion: number;
  renderState: VideoState;
  renderRunId: string;
  videoManifest: ArtifactManifest | null;
  audioAssetId: string;
  materialAssetIds: string[];
}
```

新增 `video-scene-plan.schema.json`，核心字段：

- `schemaVersion`
- `sourceMode`
- `aspectRatio`
- `fps`
- `durationInFrames`
- `theme`
- `scenes[]`
- `captionStyle`
- `audioPlan`
- `missingMaterials[]`
- `generationMeta.skillEvidence`

场景必须使用稳定 ID，后续编辑和重新渲染不得因为排序变化而丢失素材绑定。

## 5. 技术架构

### 5.1 目录

新增独立渲染子项目，避免污染已经稳定的 Web 与 Bridge 构建：

```text
video-renderer/
├── package.json
├── src/
│   ├── Root.tsx
│   ├── compositions/
│   │   ├── LandscapeVideo.tsx
│   │   └── PortraitVideo.tsx
│   ├── scenes/
│   │   ├── OpeningScene.tsx
│   │   ├── StatementScene.tsx
│   │   ├── FlowScene.tsx
│   │   ├── ComparisonScene.tsx
│   │   ├── ScreenshotScene.tsx
│   │   └── SummaryScene.tsx
│   ├── components/
│   └── schemas/
└── public/
```

工作站负责内容、任务和状态；`video-renderer` 只负责读取已经校验的场景 JSON 和本地素材并预览、渲染。

### 5.2 新任务类型

Bridge 增加两类任务：

- `video-plan`：调用本机 Codex，将确认内容或确认 HTML 转成严格场景 JSON。
- `video-render`：不调用 Codex，启动受控的本地 Remotion 渲染进程。

不允许 Codex 每期任意修改渲染器源码。模板升级属于代码发布；每期内容只改变 JSON 和允许的素材文件。

### 5.3 Codex 任务规则

仓库 Skill 增加 `Video planning workflow`：

- 输入只能来自已确认内容、可选的已验收 HTML、视频风格配置和已登记素材。
- HTML 模式提取章节、流程、对比、重点和主题色，不逐像素复制页面。
- 直接模式按口播结构生成视觉节奏。
- 不虚构真人素材、项目截图、数据或案例。
- 缺少素材写入 `missingMaterials`，不得偷偷生成替代事实。
- 输出只允许符合 Schema 的 JSON，不直接生成 MP4。

### 5.4 本地渲染安全边界

- Remotion 子进程参数使用固定白名单，不拼接 shell 命令。
- 输入只允许工作区内的 JSON、PNG、JPEG、SVG、MP3、WAV、MP4。
- 禁止远程 URL、符号链接和 `../` 路径。
- 限制单文件大小、总素材大小、最长视频时长和渲染超时。
- 首版只监听本机，不开放远程渲染接口。
- 渲染进程支持取消，取消后清理临时帧和未完成 MP4。

## 6. 产物契约

### 6.1 视频方案产物

```text
output/video-scene-plan.json
```

### 6.2 视频工程与最终产物

```text
output/video-project/
├── input-props.json
├── assets/
└── README.md
output/video.mp4
output/video-poster.png
output/manifest.json
```

视频 manifest 新增：

- `taskType: "video-render"`
- `generationMode: "remotion-local-render"`
- `video-mp4`
- `video-poster`
- 宽高、帧率、总帧数、时长、文件大小和 SHA-256
- Remotion 版本与模板版本

验收器必须检查：

- MP4 文件真实存在且不是符号链接；
- 路径位于任务输出目录；
- 宽高和画幅符合配置；
- 时长与场景方案误差在允许范围；
- 文件非空且可被媒体探测器读取；
- poster 尺寸与视频一致；
- manifest 哈希与文件一致。

## 7. 完整交付包调整

ZIP 导出继续按“已验收资产”打包：

```text
content/content-script.md
recording/presentation.html         # 如生成并验收
video/video-scene-plan.json         # 如确认
video/video.mp4                     # 如渲染并验收
video/video-poster.png              # 如渲染并验收
video/video-project/                # 用户选择导出工程时加入
covers/
publishing/publishing-package.md
README.txt
```

只生成 HTML 时，ZIP 结构与现有版本保持兼容；没有视频的旧内容无需迁移文件。

## 8. Codex 可执行开发任务

状态说明：`[x] 已完成`、`[~] 进行中`、`[ ] 待开始`。

| 编号 | 状态 | 任务 | 主要改动 | 验收标准 |
|---|---|---|---|---|
| R00 | [x] | 完成技术与产品方案 | 本计划 | 明确三条制作路线、边界和分阶段交付 |
| R01 | [x] | 建立 Remotion 独立样片工程 | `video-renderer/` | 固定 JSON 能在 Studio 预览并渲染 30 秒 16:9 MP4 |
| R02 | [x] | 建立场景 Schema 与示例 | `schemas/video-scene-plan.schema.json`、fixtures | 合法方案通过，未知字段、越界时长和非法素材路径失败 |
| R03 | [x] | 实现基础场景组件 | `video-renderer/src/scenes/` | 开场、观点、流程、对比、截图、总结六种场景可组合 |
| R04 | [ ] | 增加 `video-plan` Codex 任务 | Bridge、Skill、任务定义 | 直接内容模式得到严格 JSON，任务可停止、恢复和重试 |
| R05 | [ ] | 支持 HTML 演化视频 | HTML 解析快照、Skill、Schema | 只有已验收 HTML 可作为来源；章节顺序和核心信息可追溯 |
| R06 | [ ] | 增加视频选择与状态模型 | `app/page.tsx`、持久化迁移 | 可独立选择 HTML 和视频；旧数据加载不报错 |
| R07 | [ ] | 开发场景方案查看与编辑 | 动态视频页签 | 场景可编辑、排序、复制、删除并人工确认 |
| R08 | [ ] | 实现本地素材登记 | Bridge 安全上传、素材库 | 允许格式、大小和路径检查通过；拒绝 URL、链接和越界文件 |
| R09 | [ ] | 实现音频与字幕输入 | 视频页签、场景数据 | 可选择无音频、上传旁白、导入字幕；未提供时不虚构对齐结果 |
| R10 | [ ] | 增加 `video-render` 本地任务 | 渲染管理器、进程取消 | 不调用 Codex；可查看进度、取消、失败原因和耗时 |
| R11 | [ ] | 实现 MP4 与 poster 验收 | manifest Schema、validator | 尺寸、时长、哈希、媒体可读性检查通过 |
| R12 | [ ] | 工作站内嵌 Remotion 预览 | Remotion Player 或受控预览页 | 未渲染前可预览；参数变化即时生效，不启动公开服务 |
| R13 | [ ] | 支持续改与失效规则 | 状态机、任务中心 | 改内容、HTML、场景或素材时只失效对应下游资产 |
| R14 | [ ] | 扩展完整 ZIP 导出 | `content-bundle.mjs` | HTML 和视频按实际已验收状态独立加入 ZIP |
| R15 | [ ] | 增加 Fake Runner 与假渲染器 | tests/fixtures、CI | GitHub CI 不调用 Codex、不启动真实浏览器渲染也能测全链路 |
| R16 | [ ] | 增加真实本地冒烟入口 | `smoke:video` | 必须显式 `--yes`；验证 plan、render、cancel 三个范围 |
| R17 | [ ] | 完成 30～60 秒真实样片验收 | 一个已确认选题 | 直接视频与 HTML 演化至少各完成一次，对比质量和耗时 |
| R18 | [ ] | 增加 9:16 独立构图 | 竖版 Composition | 不是横版裁切；标题、字幕和流程在安全区内 |
| R19 | [ ] | 支持 5～8 分钟视频 | 分段渲染与资源限制 | 长视频可稳定渲染、取消和恢复，不阻塞工作站数据保存 |
| R20 | [ ] | 更新安装、Doctor 和许可证提示 | README、Doctor、设置页 | 检测 Remotion/Chrome/FFmpeg 条件并说明商业许可证边界 |

## 9. 开发批次

### V0：技术闸门

范围：R01～R03。

结束条件：不接工作站，先证明固定场景 JSON 能预览并渲染 30 秒样片；确认 macOS 渲染依赖、速度、文件体积和许可证边界。

若闸门失败：不修改现有工作站，HTML 链路完全不受影响。

#### V0 验收记录（2026-08-12）

- 独立安装 Remotion `4.0.508`、CLI、Renderer 与 Transitions，所有 Remotion 包版本一致。
- 固定场景方案通过 JSON Schema 和连续时间轴校验：6 个场景、900 帧、30fps、30 秒、1920×1080。
- 负向测试确认未知字段、单场景超长和 `../` 非法素材路径会被拒绝；2 项测试通过，TypeScript 类型检查通过。
- 六种场景均完成真实渲染并通过中间帧检查；修复了观点场景长标题单字换行问题。
- Poster 成功输出为 1920×1080 PNG；完整 MP4 成功输出为 H.264、1920×1080、30fps、30.06 秒、3,813,130 字节。
- 当前电脑完整渲染实际耗时 20.23 秒，首次额外下载约 93.5MB Chrome Headless Shell；后续使用缓存。
- 当前包内许可证说明允许个人免费制作商业或非商业视频；对外开放或组织使用仍需按实体规模核对并可能购买公司许可证。
- 阶段结论：V0 技术闸门通过。Remotion 保持独立子项目，现有 HTML、Bridge、内容数据和工作站服务未被改造。

### V1：Codex 场景方案

范围：R04～R07。

结束条件：内容确认后能选择直接生成或基于 HTML 生成；场景 JSON 自动回填、可编辑并确认。

这一批不渲染 MP4，先验证内容拆镜质量。

### V2：素材与本地渲染

范围：R08～R12。

结束条件：上传有限素材和旁白后，可预览并渲染 16:9 MP4，任务可以停止和重试。

### V3：状态、导出与自动测试

范围：R13～R16。

结束条件：失效逻辑、ZIP、任务中心、Fake Runner、隐私扫描和真实冒烟入口全部通过。

### V4：真实内容验收

范围：R17。

结束条件：同一选题分别完成“直接视频”和“HTML 演化视频”，记录人工调整次数、渲染耗时、成片可用性和相对 HTML 录屏的节省时间。

### V5：多尺寸与长视频

范围：R18～R20。

启动条件：V4 证明 30～60 秒样片有实际价值。先完成独立竖版构图，再扩展 5～8 分钟，避免过早承担长视频渲染复杂度。

## 10. 验收命令规划

开发后至少提供：

```bash
npm run doctor
npm run test:ci
npm run dev:local
npm run video:studio -- --run-id <run-id>
npm run smoke:video -- plan --yes
npm run smoke:video -- render --yes
npm run smoke:video -- cancel --yes
```

GitHub CI 只运行 Fake Codex 和假渲染器；真实 Codex、Remotion 浏览器和 MP4 渲染只在本机显式执行。

## 11. 关键风险与控制

### 11.1 视频质量不等于自动化程度

第一版追求“可用的结构化辅助画面”，不承诺自动生成成熟商业短片。场景方案必须可编辑、可确认。

### 11.2 HTML 直接转换的边界

HTML 可能包含复杂 CSS 和交互，第一版不运行任意 HTML 截图录制，也不把 HTML 原样嵌入 Remotion。只读取工作站已验收的自包含页面并抽取结构化信息，防止不稳定动画和外部资源进入渲染链路。

### 11.3 长视频成本

5～8 分钟视频会显著增加渲染时间、磁盘和失败恢复成本，因此必须在短样片闸门通过后再开发。

### 11.4 真人出镜

第一版支持把已剪好的出镜片段作为素材放入场景，不负责自动口型、智能抠像和复杂镜头剪辑。这些能力后续按真实需求单独评估。

### 11.5 许可证

Remotion 使用特殊许可证。个人本地样片和未来对外开放工作站是不同使用场景；开放给其他用户或商业团队前，必须重新核对当时官方许可证与商业授权要求。

## 12. 建议执行顺序

下一次开发从 **V0 / R01～R03** 开始，只新增独立 `video-renderer` 样片工程，不改动现有内容数据和 HTML 生产链路。短样片可以稳定预览和渲染后，再进入 V1，把 Codex 场景方案接入工作站。
