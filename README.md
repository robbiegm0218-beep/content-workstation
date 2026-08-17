# 内容工作站

一个用于管理选题、内容稿、视觉制作、多平台发布和数据复盘的本地内容生产工作台。

## 当前生产流程

1. 填写议题、受众痛点、核心观点和真实案例。
2. 可先让 Codex 联网调研同类选题，查看真实来源、内容空白和三个建议角度。
3. 生成“仅内容”Codex 任务，得到可编辑 Markdown 草稿。
4. 在内容库中查看、编辑并人工确认内容稿。
5. 内容确认后，分别选择 HTML 页面风格与封面风格。
6. 独立生成 HTML 任务和三尺寸封面任务。
7. 完成录制、发布并回填平台数据。
8. 在内容详情的“交付物”页下载本期完整 ZIP。

内容项目可在内容详情中删除，案例可在案例卡片中删除；设置页支持一次性清空全部内容、案例和运营数据，同时保留账号设置。

## 历史内容维护

- 内容库右上角提供“归档历史内容”，用于录入并非从工作站创建的旧视频或图文。
- 可记录发布日期、发布平台、平台链接、原稿、核心观点、归档备注和首轮运营数据。
- 保存后会标记为“历史归档”，与“工作站创作”内容区分；后续仍可在详情中维护资料和各平台数据。
- 工作台统计、平台对比和数据复盘会同时读取新内容与历史归档，形成完整账号数据。

内容稿修改后会自动回到“编辑中”，已经生成的 HTML 和封面会被标记为“待生成”，避免下游资产继续使用旧版本内容。

## 视觉风格

- HTML：专业科技、极简信息图、杂志卡片、白板讲解。
- 封面：高对比科技、大字观点、杂志编辑、人物留白。

## 本地运行

需要 Node.js `>=22.13.0`，并在本机安装、登录 Codex CLI。

### 第一次运行

如果 SSH 克隆提示 `Permission denied (publickey)`，可直接使用公开 HTTPS 地址：

```bash
git clone https://github.com/robbiegm0218-beep/content-workstation.git
cd content-workstation
```

进入项目目录后，在**终端**中依次执行：

```bash
npm install
npm install --global @openai/codex
codex login
codex plugin marketplace add .
codex plugin add creator-content-studio@personal
npm run doctor
npm run dev:local
```

`codex login` 会打开浏览器完成 ChatGPT 登录；可用 `codex login status` 查看当前认证方式。启动后打开 `http://localhost:3000/`，页面会自动显示首次使用向导，完成 Codex 检测和账号资料设置。

### 从下载到生成第一条内容

其他用户使用的是自己的 Codex 账号、额度和本机数据，不会关联仓库作者的账号，也不需要在工作站填写 OpenAI 或 DeepSeek API Key。完整链路如下：

1. **操作位置：系统浏览器。**下载安装 Git 和 Node.js `22.13.0` 或更高版本。已经安装的用户可以跳过。
2. **操作位置：电脑终端。**打开 macOS 的“终端”或 Windows 的 PowerShell，后续安装、登录和启动命令都在这里运行。
3. **操作位置：电脑终端。**克隆仓库并进入项目目录：

   ```bash
   git clone https://github.com/robbiegm0218-beep/content-workstation.git
   cd content-workstation
   ```

4. **操作位置：电脑终端。**安装工作站依赖：

   ```bash
   npm install
   ```

5. **操作位置：电脑终端，然后切换到系统浏览器。**安装 Codex CLI 并发起登录：

   ```bash
   npm install --global @openai/codex
   codex login
   ```

   `codex login` 会自动打开系统浏览器。请在浏览器中登录你自己的 ChatGPT/Codex 账号，完成后回到终端。

6. **操作位置：电脑终端，且当前目录必须是仓库根目录。**关联仓库自带的创作者内容插件：

   ```bash
   codex plugin marketplace add .
   codex plugin add creator-content-studio@personal
   ```

   第一条命令让 Codex 识别当前仓库的本地插件市场；第二条命令安装并启用 `creator-content-studio`。工作站即使未安装插件也能调用仓库内置的三个 Skills，但安装后还可以在 Codex 新任务中直接使用内容、视觉和视频规划能力。

7. **操作位置：电脑终端。**检查 Codex 登录、插件源码、插件安装状态、工作目录和本地端口：

   ```bash
   npm run doctor
   ```

   如果出现失败项，按照终端给出的“处理方式”修复后，再运行一次该命令。

8. **操作位置：电脑终端。**启动内容工作站。这个终端窗口需要保持打开：

   ```bash
   npm run dev:local
   ```

9. **操作位置：系统浏览器。**访问 `http://localhost:3000/`，在首次使用向导中填写自己的身份、经历、目标受众、表达风格和内容目标。
10. **操作位置：内容工作站网页。**进入“设置”→“Codex 连接中心”，点击“重新检测连接”。“创作者插件源码”应显示通过；“Codex 插件关联”显示通过后，既可使用工作站链路，也可在 Codex 新任务中独立调用插件。

首次设置完成后，工作站可以直接调用用户本机已登录的 Codex，完成：

- 同类选题调研和三个切入角度；
- 内容稿生成、编辑、版本选择与人工确认；
- HTML 录屏页面和三尺寸封面；
- 已选平台发布包；
- Remotion 动态视频方案、本机 MP4 渲染和断点续渲；
- 本期完整 ZIP 交付包。

内容、账号资料、任务记录和生成文件默认只保存在当前用户的电脑中。当前版本没有云端同步、多人账号共享或自动发布功能。

如果需要生成 Remotion 动态视频，请回到**电脑终端**，在项目目录中执行：

```bash
npm run video:install
npm run video:browser
npm run doctor
```

动态视频还需要本机提供 `ffmpeg` 和 `ffprobe`。可先运行 `ffmpeg -version` 与 `ffprobe -version` 检查；缺失时请从 [FFmpeg 官方下载页](https://ffmpeg.org/download.html) 选择对应系统的安装方式。只使用内容稿、HTML 和封面时，可以暂不安装视频环境。

### 以后启动

打开**电脑终端**，进入 `content-workstation` 项目目录后运行：

```bash
npm run dev:local
```

这一条命令会同时启动网页和本机 Codex Bridge。终端窗口需要在使用期间保持打开；完成使用后，在终端按 `Ctrl+C` 会一起停止两个服务。

如果首次检查未通过：

- 提示找不到 Codex：运行 `npm install --global @openai/codex`。
- 提示未登录：运行 `codex login`，完成浏览器登录后回到设置页重新检测。
- 提示创作者插件源码不完整：确认终端位于完整 Git 仓库，而不是只复制了网页构建产物。
- 提示 Codex 插件未关联：在仓库根目录运行 `codex plugin marketplace add .`，再运行 `codex plugin add creator-content-studio@personal`。
- 提示 Remotion 包缺失或版本不一致：运行 `npm run video:install`。
- 提示视频渲染浏览器未准备：运行 `npm run video:browser`；该命令需要联网下载 Remotion 对应版本的 Headless Chrome。
- 提示 FFmpeg 或 FFprobe 不可用：安装 FFmpeg 后重新运行 `npm run doctor`。
- 提示端口占用：先关闭之前启动的内容工作站，再重新运行 `npm run dev:local`。
- 需要机器可读诊断结果：运行 `npm run doctor -- --json`。

## 验证命令

```bash
npm run lint
npm test
```

GitHub Actions 运行 `npm run test:ci`，其中 Bridge 集成测试使用 Fake Runner，不要求安装或登录 Codex，也不会消耗 Codex 额度。

CI 会先运行 `npm run check:privacy`，检查所有 Git 跟踪文件是否包含真实密钥、认证文件、`.data/work/outputs` 本机数据或用户目录绝对路径。提交前也可以单独运行这条命令。

首次安装若 `npm audit` 报告开发工具的间接依赖风险，请先阅读 [SECURITY.md](./SECURITY.md)。生产依赖可用 `npm audit --omit=dev` 单独核实；不要直接执行 `npm audit fix --force`，强制处理可能降级构建工具并破坏兼容性。

需要在本机验证真实 Codex 时，必须明确选择范围并添加 `--yes`：

```bash
npm run smoke:codex -- content --yes
npm run smoke:codex -- html --yes
npm run smoke:codex -- cover --yes
npm run smoke:codex -- publishing --yes
npm run smoke:codex -- video-plan --yes
# 或依次执行以上三项
npm run smoke:codex -- full --yes
```

`cover` 和 `full` 可能调用图片生成，耗时及额度消耗高于内容稿与 HTML。使用 `npm run smoke:codex -- --help` 可查看全部范围；真实冒烟测试不会进入 GitHub CI。

## 数据与模型配置

- 内容、案例、设置和生产状态优先保存在本机 Bridge 的 `.data/workstation-state.json`，浏览器 `localStorage` 作为兜底；Bridge 每次成功保存前还会保留上一份有效快照，主文件损坏时自动回滚。仍建议定期从设置页导出 JSON 备份。
- 每个本地使用者拥有独立数据；仓库不包含个人内容、账号资料或真实 API Key。
- 应用不再预置演示内容和案例，首次打开时内容库为空。
- 动态选题角度通过本机 Codex Bridge 生成，与内容稿、HTML、封面和发布包共用同一连接。
- 当前内容生产不需要 DeepSeek 或 OpenAI API Key；本机 Codex 登录信息也不会写入仓库。
- 当前选题角度、内容、HTML、封面和发布包通过本机 Codex 独立生成并自动回写。
- 设置页“Codex 连接中心”可检查本机登录、版本、Skill、图片、Remotion 包、Headless Chrome、FFmpeg/FFprobe 与渲染能力；“任务中心”统一显示历史任务、运行状态、停止和按原输入重试。
- 联网选题调研只展示实际找到且可核验的公开来源；平台不可访问时会明确标记并给出人工补充步骤。

## 产物位置与导出

- 每次 Codex 任务的原始产物保存在 `work/runs/<run-id>/output/`；HTML、封面和发布包可能来自不同任务目录。
- 内容详情的“交付物”页提供“下载 ZIP”，只打包当前已验收版本。
- ZIP 按 `content/`、`recording/`、`covers/`、`video/`、`publishing/` 分类，并附带 `README.txt`；视频方案、MP4 和 poster 只在对应资产已确认或已验收且本期启用视频时加入。
- ZIP 为即时下载文件，不额外写入项目仓库；原始产物仍保留在对应任务目录中。

## Remotion 动态视频（V5 竖屏与长视频验收完成）

仓库已包含独立的 `video-renderer/` 工程，并在内容工作站中完成场景方案、素材、预览、渲染、验收与 ZIP 导出闭环，不改变现有 HTML 录屏功能。内容稿确认后，可以独立选择是否生成 HTML 和动态视频；视频方案支持：

- 直接根据已确认内容生成；
- 基于已接受 HTML 的章节顺序演化；
- 选择知识卡片、流程演示、口播辅助或 HTML 视觉演化风格；
- 逐场编辑标题、正文、旁白、类型、时长、转场和字幕；
- 排序、复制、删除并人工确认方案。

工作站会先生成可编辑、可确认的场景方案，可选择 30 秒、5 分钟或 8 分钟，以及 16:9 横版或 9:16 竖版，再由用户主动渲染 MP4，避免内容判断与耗时渲染被绑成一次不可控操作。9:16 使用独立竖屏 Composition 和字幕安全区，不是横版裁切。5～8 分钟任务会按场景边界分段，失败、取消或中断后可在原任务中继续，已经校验完成的分段不会重复渲染。固定样片仍可用以下命令验证：

```bash
npm run video:install
npm run video:check
npm run video:studio
# 或直接渲染样片
npm run video:render:sample
```

Studio 使用 `http://localhost:3100/`，与内容工作站的 3000 端口分离。工作站现已支持本地素材登记、旁白/字幕选择、Remotion Player 预览，以及带真实进度、停止和自动验收的 16:9 / 9:16 MP4 渲染。素材和成片都只保存在本机 `.data/` 与隔离任务目录；视频验收后可在“交付物”中播放并单独下载 MP4 与 poster。详见 [REMOTION_INTEGRATION_PLAN.md](./REMOTION_INTEGRATION_PLAN.md)。Remotion 使用特殊许可证，个人本地使用与未来向其他用户提供平台的授权条件不同，对外开放前需要再次核对官方条款。

截至本次验收，Remotion 官方将个人和不超过 3 人的组织列为免费许可证范围，并允许商业使用；4 人以上团队，以及把视频生成能力做成供他人使用的应用或自动化服务，需要按实际使用方式核对 Company License。许可和价格可能变化，请以 [Remotion 官方页面](https://www.remotion.dev/) 为准，工作站内的提示不构成法律意见。

V4 已使用同一条 RAG 真实选题分别完成直接内容视频与 HTML 演化视频。两条样片均为 30 秒、1920×1080；HTML 演化路线在结构和视觉一致性上更稳定，直接路线在自由绑定素材方面更灵活。完整数据、人工调整和路线建议见 [V4_VIDEO_ACCEPTANCE_REPORT.md](./V4_VIDEO_ACCEPTANCE_REPORT.md)。本地样片保存在 `outputs/v4-acceptance/`，该目录不进入 Git。

V5 已完成 R18 竖屏独立构图：真实 30 秒样片为 1080×1920、30fps，标题、流程卡片和字幕均按竖屏安全区布局。完整验收见 [V5_PORTRAIT_ACCEPTANCE_REPORT.md](./V5_PORTRAIT_ACCEPTANCE_REPORT.md)，本地样片保存在 `outputs/v5-r18-portrait/`，该目录不进入 Git。

V5 已完成 R19 长视频分段渲染：真实 5 分钟方案被拆为 5 个场景边界分段，主动中断后成功复用第 1 段并完成续渲；最终 MP4 为 300.27 秒、1920×1080、30fps。完整验收见 [V5_LONG_VIDEO_ACCEPTANCE_REPORT.md](./V5_LONG_VIDEO_ACCEPTANCE_REPORT.md)，本地验收工作区位于 `work/v5-r19-long-smoke/`，不进入 Git。

真实视频冒烟分为三种显式模式，不会进入 GitHub CI：

```bash
npm run smoke:video -- plan --yes
npm run smoke:video -- cancel --yes
npm run smoke:video -- render --yes
```

`plan` 只校验场景方案；`cancel` 验证真实 Remotion 进程可以安全停止；`render` 会在系统临时目录中渲染一条 30 秒测试视频并校验 MP4、poster、时长、尺寸和哈希，不会写入内容库。所有模式都必须显式添加 `--yes`。

## 共享代码与后续开放

当前版本适合先推送到 Git，供其他人克隆后本地运行：默认账号资料为通用占位内容，密钥通过 `.env.local` 配置且不会提交，个人内容与任务保留在使用者本机且 `.data` 不进入 Git。若后续要作为在线平台开放，应将内容、案例、平台数据和用户设置迁移到带用户归属的云数据库，并增加登录、权限、数据导出及隐私策略；不应把本机存储直接作为在线版本的数据源。
