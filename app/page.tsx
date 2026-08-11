"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  cancelBridgeRun,
  connectLocalBridge,
  continueBridgeRun,
  createContentRun,
  createTopicAnglesRun,
  createTopicResearchRun,
  createVisualRun,
  getArtifactBlob,
  getArtifactManifest,
  getBridgeRun,
  getContentBundle,
  getContentResult,
  getTopicAnglesResult,
  getTopicResearchResult,
  getWorkstationState,
  listBridgeRuns,
  retryBridgeRun,
  runBridgeDoctor,
  saveWorkstationState,
} from "./lib/local-bridge";
import type { ArtifactManifest, BridgeRun, BridgeRunStatus, DoctorReport, TopicResearchResult } from "./lib/local-bridge";

type View = "dashboard" | "create" | "library" | "cases" | "review" | "tasks" | "settings";
type ContentStatus = "选题草稿" | "待生成" | "已生成" | "待录制" | "已录制" | "已发布" | "已复盘";
type Platform = "B站" | "小红书" | "视频号" | "抖音";
type RecordingMode = "出镜口播" | "HTML录屏" | "混合录制" | "未设置";
type DraftState = "未生成" | "编辑中" | "已确认";
type AssetState = "未开始" | "待生成" | "已生成";
type HtmlStyle = "专业科技" | "极简信息图" | "杂志卡片" | "白板讲解";
type CoverStyle = "高对比科技" | "大字观点" | "杂志编辑" | "人物留白" | "高冲击人物科技";
type ContentOrigin = "工作站创作" | "历史归档";
type ContentVersionState = "候选" | "已采用";

type ContentVersion = {
  version: number;
  runId: string;
  createdAt: string;
  subtitle: string;
  pain: string;
  viewpoint: string;
  script: string;
  state: ContentVersionState;
};

type Metric = {
  platform: Platform;
  views: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  follows: number;
};

type ContentItem = {
  id: string;
  title: string;
  subtitle: string;
  audience: string;
  pain: string;
  viewpoint: string;
  cases: string;
  status: ContentStatus;
  platforms: Platform[];
  outputs: string[];
  recordingMode: RecordingMode;
  productionPlan: string;
  createdAt: string;
  updatedAt: string;
  script: string;
  draftState: DraftState;
  htmlState: AssetState;
  coverState: AssetState;
  publishingState: AssetState;
  htmlStyle: HtmlStyle;
  coverStyle: CoverStyle;
  metrics: Metric[];
  origin: ContentOrigin;
  publishedAt: string;
  publishLinks: Partial<Record<Platform, string>>;
  archiveNotes: string;
  contentVersion: number;
  acceptedRunId: string;
  latestRunId: string;
  latestRunStatus: BridgeRunStatus | "idle";
  contentVersions: ContentVersion[];
  htmlRunId: string;
  coverRunId: string;
  pendingHtmlRunId: string;
  pendingCoverRunId: string;
  htmlManifest: ArtifactManifest | null;
  coverManifest: ArtifactManifest | null;
  pendingHtmlManifest: ArtifactManifest | null;
  pendingCoverManifest: ArtifactManifest | null;
  publishingRunId: string;
  pendingPublishingRunId: string;
  publishingManifest: ArtifactManifest | null;
  pendingPublishingManifest: ArtifactManifest | null;
};

type CaseItem = {
  id: string;
  title: string;
  industry: string;
  background: string;
  action: string;
  result: string;
  tags: string[];
};

type Settings = {
  name: string;
  role: string;
  experience: string;
  audience: string;
  style: string;
  goal: string;
  defaultPlatforms: Platform[];
};

type Database = {
  contents: ContentItem[];
  cases: CaseItem[];
  settings: Settings;
};

type ContentForm = {
  title: string;
  subtitle: string;
  whyNow: string;
  audience: string;
  pain: string;
  viewpoint: string;
  sources: string;
  cases: string;
  duration: string;
  platforms: Platform[];
  outputs: string[];
  recordingMode: Exclude<RecordingMode, "未设置">;
};

type TopicAngle = {
  type: string;
  title: string;
  viewpoint: string;
  audiencePain: string;
  contentValue: string;
  evidenceNeeded: string;
};

type HistoryForm = {
  title: string;
  subtitle: string;
  publishedAt: string;
  platforms: Platform[];
  recordingMode: RecordingMode;
  viewpoint: string;
  script: string;
  archiveNotes: string;
  publishLinks: Partial<Record<Platform, string>>;
  metrics: Metric[];
};

const STORAGE_KEY = "content-workstation-v2";
const LEGACY_STORAGE_KEY = "pm-content-studio-v1";
const platforms: Platform[] = ["B站", "小红书", "视频号", "抖音"];
const statuses: ContentStatus[] = ["选题草稿", "待生成", "已生成", "待录制", "已录制", "已发布", "已复盘"];
const recordingModes: Exclude<RecordingMode, "未设置">[] = ["出镜口播", "HTML录屏", "混合录制"];
const htmlStyles: Record<HtmlStyle, { mark: string; description: string }> = {
  专业科技: { mark: "深", description: "深色后台感，适合系统链路、AI 与数据主题。" },
  极简信息图: { mark: "简", description: "白底高留白，适合框架、清单和方法说明。" },
  杂志卡片: { mark: "刊", description: "强调版式节奏，适合观点、对比与案例叙事。" },
  白板讲解: { mark: "板", description: "手绘箭头与便签感，适合接地气的拆解教学。" },
};
const coverStyles: Record<CoverStyle, { mark: string; description: string; guidance?: string }> = {
  高对比科技: { mark: "亮", description: "深底亮色，适合 AI、系统与技术实战。" },
  大字观点: { mark: "字", description: "文字占主视觉，适合冲突判断和强结论。" },
  杂志编辑: { mark: "刊", description: "克制、有质感，适合长期专业账号。" },
  人物留白: { mark: "人", description: "预留人物位置，适合出镜账号增强识别度。" },
  高冲击人物科技: {
    mark: "冲",
    description: "超短大标题＋本人形象＋话题物件；无本人照片时自动改用焦点物体。",
    guidance: "使用超短大标题、强明暗对比和一个高饱和强调色。仅在提供并明确授权创作者本人照片时使用人物抠图、轮廓光和自然手势；没有本人照片时不得生成随机人物，改用产品图标、界面局部或关键物件作为主体。装饰元素控制在 1～2 个，不模仿参考博主的脸、文案、品牌或固定版式。",
  },
};
const recordingModeCopy: Record<Exclude<RecordingMode, "未设置">, { icon: string; title: string; description: string; bestFor: string }> = {
  出镜口播: { icon: "人", title: "出镜口播", description: "以真人表达为主，穿插素材和字幕。", bestFor: "职业观点、个人经历、判断冲突" },
  HTML录屏: { icon: "屏", title: "HTML录屏", description: "生成静态页面，按页面顺序录屏讲解。", bestFor: "方法框架、流程、对比与案例拆解" },
  混合录制: { icon: "合", title: "混合录制", description: "出镜开场与总结，中间用 HTML 讲清主体。", bestFor: "兼顾个人信任与知识收藏" },
};
const outputsByMode: Record<Exclude<RecordingMode, "未设置">, string[]> = {
  出镜口播: ["出镜口播稿", "录制提词版", "素材插入清单", "镜头与字幕提示", "四平台发布包", "三尺寸封面图"],
  HTML录屏: ["录屏版口播稿", "静态 HTML 演示页", "页面与演讲稿映射", "页面切换提示", "四平台发布包", "三尺寸封面图"],
  混合录制: ["出镜开场与总结稿", "录屏主体口播稿", "静态 HTML 演示页", "出镜与录屏切换时间轴", "素材插入清单", "四平台发布包", "三尺寸封面图"],
};
function productionPlanFor(mode: Exclude<RecordingMode, "未设置">) {
  if (mode === "出镜口播") return "出镜开场 → 观点与案例口播 → 穿插素材/B-roll → 出镜总结与 CTA";
  if (mode === "HTML录屏") return "问题页 → 核心判断页 → 方法/案例页 → 行动清单页；按页面顺序完成录屏与旁白";
  return "出镜开场 20～30 秒 → HTML 主体 4～6 分钟 → 必要时切回出镜强调经历 → 出镜总结 20～30 秒";
}

function publishingPackageLabel(selectedPlatforms: Platform[]) {
  if (selectedPlatforms.length === 1) return `${selectedPlatforms[0]}发布包`;
  if (selectedPlatforms.length > 1) return `${selectedPlatforms.length}平台发布包`;
  return "平台发布包";
}

function selectedPlatformNames(selectedPlatforms: Platform[]) {
  return selectedPlatforms.length ? selectedPlatforms.join("、") : "尚未选择平台";
}

function missingPublishingAssets(item: ContentItem) {
  const missing: string[] = [];
  const needsHtml = item.recordingMode === "HTML录屏" || item.recordingMode === "混合录制";
  if (needsHtml && !(item.htmlState === "已生成" && item.htmlManifest && item.htmlRunId)) missing.push("HTML");
  if (!(item.coverState === "已生成" && item.coverManifest && item.coverRunId)) missing.push("三尺寸封面");
  return missing;
}

function publishingDisabledReason(item: ContentItem) {
  const missing = missingPublishingAssets(item);
  return missing.length ? `请先接受${missing.join("与")}` : "";
}

function productionStagesFor(item: ContentItem) {
  const needsHtml = item.recordingMode === "HTML录屏" || item.recordingMode === "混合录制";
  const recorded = ["已录制", "已发布", "已复盘"].includes(item.status);
  const published = ["已发布", "已复盘"].includes(item.status);
  return [
    { title: "选题简报", description: "标题、人群和核心观点已进入内容库", done: Boolean(item.title.trim()) },
    { title: "内容草稿", description: "生成并回填可编辑的完整稿件", done: Boolean(item.script.trim()) },
    { title: "确认内容", description: "人工确认后才进入视觉制作", done: item.draftState === "已确认" },
    { title: needsHtml ? "HTML 录屏页" : "画面素材方案", description: needsHtml ? `当前风格：${item.htmlStyle}` : "出镜内容无需 HTML 页面", done: !needsHtml || Boolean(item.htmlState === "已生成" && item.htmlManifest && item.htmlRunId) },
    { title: "三尺寸封面", description: `当前风格：${item.coverStyle}`, done: Boolean(item.coverState === "已生成" && item.coverManifest && item.coverRunId) },
    { title: publishingPackageLabel(item.platforms), description: `面向${selectedPlatformNames(item.platforms)}，验收后可下载 Markdown`, done: Boolean(item.publishingState === "已生成" && item.publishingManifest && item.publishingRunId) },
    { title: "录制与发布", description: published ? "内容已经发布" : recorded ? "已录制，等待发布" : "视觉资产完成后进入录制", done: published },
  ];
}

const legacyTestContentIds = new Set(["content-ai-transition", "content-agent-selection", "content-prd"]);
const legacyTestCaseIds = new Set(["case-kb-evaluation", "case-carbon-data", "case-retail"]);

function normalizeDatabase(data: Database): Database {
  return {
    ...data,
    contents: data.contents.filter((item) => !legacyTestContentIds.has(item.id) && !item.id.startsWith("content-test-")).map((item) => ({
      ...item,
      recordingMode: item.recordingMode || "未设置",
      productionPlan: item.productionPlan || "录制方式待设置",
      draftState: item.draftState || (item.script ? "编辑中" : "未生成"),
      htmlState: item.htmlState || "未开始",
      coverState: item.coverState || "未开始",
      publishingState: item.publishingState || "未开始",
      htmlStyle: item.htmlStyle || "专业科技",
      coverStyle: item.coverStyle || "高对比科技",
      origin: item.origin || "工作站创作",
      publishedAt: item.publishedAt || "",
      publishLinks: item.publishLinks || {},
      archiveNotes: item.archiveNotes || "",
      contentVersion: item.contentVersion || 0,
      acceptedRunId: item.acceptedRunId || "",
      latestRunId: item.latestRunId || "",
      latestRunStatus: item.latestRunStatus || "idle",
      contentVersions: item.contentVersions || [],
      htmlRunId: item.htmlRunId || "",
      coverRunId: item.coverRunId || "",
      pendingHtmlRunId: item.pendingHtmlRunId || "",
      pendingCoverRunId: item.pendingCoverRunId || "",
      htmlManifest: item.htmlManifest || null,
      coverManifest: item.coverManifest || null,
      pendingHtmlManifest: item.pendingHtmlManifest || null,
      pendingCoverManifest: item.pendingCoverManifest || null,
      publishingRunId: item.publishingRunId || "",
      pendingPublishingRunId: item.pendingPublishingRunId || "",
      publishingManifest: item.publishingManifest || null,
      pendingPublishingManifest: item.pendingPublishingManifest || null,
    })),
    cases: data.cases.filter((item) => !legacyTestCaseIds.has(item.id) && !item.id.startsWith("case-test-")),
  };
}

const emptyMetrics = (): Metric[] =>
  platforms.map((platform) => ({ platform, views: 0, likes: 0, saves: 0, comments: 0, shares: 0, follows: 0 }));

const seedData: Database = {
  settings: {
    name: "内容创作者",
    role: "请填写你的身份与账号定位",
    experience: "请填写可用于内容创作的真实经历。",
    audience: "请填写你的目标受众",
    style: "请填写你希望保持的表达风格。",
    goal: "请填写内容目标与商业目标。",
    defaultPlatforms: [...platforms],
  },
  contents: [],
  cases: [],
};

const initialHistoryForm = (): HistoryForm => ({
  title: "",
  subtitle: "",
  publishedAt: today(),
  platforms: ["B站"],
  recordingMode: "未设置",
  viewpoint: "",
  script: "",
  archiveNotes: "",
  publishLinks: {},
  metrics: emptyMetrics(),
});

const initialForm: ContentForm = {
  title: "",
  subtitle: "",
  whyNow: "",
  audience: seedData.settings.audience,
  pain: "",
  viewpoint: "",
  sources: "",
  cases: "",
  duration: "5–8 分钟",
  platforms: [...platforms],
  outputs: [...outputsByMode.混合录制],
  recordingMode: "混合录制",
};

const navItems: { id: View; label: string; icon: string; eyebrow: string }[] = [
  { id: "dashboard", label: "工作台", icon: "⌂", eyebrow: "TODAY" },
  { id: "create", label: "新建内容", icon: "+", eyebrow: "CREATE" },
  { id: "library", label: "内容库", icon: "▤", eyebrow: "CONTENT" },
  { id: "cases", label: "素材与案例", icon: "◇", eyebrow: "MATERIAL" },
  { id: "review", label: "数据复盘", icon: "↗", eyebrow: "INSIGHT" },
  { id: "tasks", label: "任务中心", icon: "◌", eyebrow: "CODEX" },
  { id: "settings", label: "账号设置", icon: "◎", eyebrow: "PROFILE" },
];

const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: "CONTENT OPERATING SYSTEM", title: "今天，内容推进到哪一步？", description: "把想法、制作和数据放在一个地方，下一步会更清楚。" },
  create: { eyebrow: "NEW CONTENT BRIEF", title: "先把选题说清楚，再让 AI 动笔", description: "真实经历是内容的底稿，AI 负责整理、适配和提效。" },
  library: { eyebrow: "CONTENT LIBRARY", title: "每条内容都应该留下资产", description: "统一管理选题、稿件、封面、状态和发布结果。" },
  cases: { eyebrow: "EXPERIENCE BANK", title: "把十年经历，变成可复用的表达素材", description: "好的案例不是简历描述，而是观点成立的证据。" },
  review: { eyebrow: "PERFORMANCE REVIEW", title: "不只看播放，还要看内容带来了什么", description: "用收藏、关注和互动判断专业内容是否真的有用。" },
  tasks: { eyebrow: "CODEX TASK CENTER", title: "每个生成任务，都能找得到", description: "统一查看运行状态、错误原因、历史结果，并停止或按原输入重试。" },
  settings: { eyebrow: "ACCOUNT CONTEXT", title: "让每次生成，都更像你", description: "维护稳定的个人背景、受众、风格与内容目标。" },
};

function formatNumber(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return value.toLocaleString("zh-CN");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [db, setDb] = useState<Database>(seedData);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<ContentForm>(initialForm);
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [researchResult, setResearchResult] = useState<TopicResearchResult | null>(null);
  const [scoutTopic, setScoutTopic] = useState("");
  const [topicAngles, setTopicAngles] = useState<TopicAngle[]>([]);
  const [anglesLoading, setAnglesLoading] = useState(false);
  const [anglesError, setAnglesError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "全部">("全部");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState<HistoryForm>(initialHistoryForm);
  const [caseDraft, setCaseDraft] = useState({ title: "", industry: "", background: "", result: "" });
  const [bridgeState, setBridgeState] = useState<"checking" | "connected" | "offline">("checking");
  const [bridgeInfo, setBridgeInfo] = useState<{ version: string; activeRuns: number } | null>(null);
  const [bridgeRuns, setBridgeRuns] = useState<BridgeRun[]>([]);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [activeRun, setActiveRun] = useState<BridgeRun | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const pollingRuns = useRef(new Set<string>());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        let loadedDatabase = seedData;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          loadedDatabase = normalizeDatabase(JSON.parse(saved) as Database);
        } else {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const migrated = normalizeDatabase(JSON.parse(legacy) as Database);
            loadedDatabase = migrated;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
      } catch {
        setNotice("本地数据读取失败，已加载演示数据。");
      }
        try {
          await connectLocalBridge();
          const { state } = await getWorkstationState<Database>();
          if (state?.database) loadedDatabase = normalizeDatabase(state.database);
          else if (loadedDatabase.contents.length || loadedDatabase.cases.length || loadedDatabase.settings.name) await saveWorkstationState(loadedDatabase);
        } catch {
          // Bridge state is an additional local persistence layer; browser data remains the offline fallback.
        }
        setDb(loadedDatabase);
        setReady(true);
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    const timer = window.setTimeout(() => {
      void saveWorkstationState(db).catch(() => {});
    }, 600);
    return () => window.clearTimeout(timer);
  }, [db, ready]);

  useEffect(() => {
    if (!ready) return;
    void reconnectBridge(true);
    // Bridge recovery runs once after local content has finished loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selected = db.contents.find((item) => item.id === selectedId) ?? null;
  const workingContent = db.contents.find((item) => item.id === workingId) ?? null;
  const totals = useMemo(() => {
    const metrics = db.contents.flatMap((item) => item.metrics);
    return metrics.reduce(
      (sum, metric) => ({
        views: sum.views + metric.views,
        saves: sum.saves + metric.saves,
        follows: sum.follows + metric.follows,
        interactions: sum.interactions + metric.likes + metric.saves + metric.comments + metric.shares,
      }),
      { views: 0, saves: 0, follows: 0, interactions: 0 },
    );
  }, [db.contents]);

  const filteredContents = db.contents.filter((item) => {
    const matchesSearch = `${item.title}${item.subtitle}${item.viewpoint}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === "全部" || item.status === statusFilter);
  });

  const priorityContent = useMemo(() => {
    const sorted = [...db.contents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sorted.find((item) => item.status !== "已发布" && item.status !== "已复盘") ?? sorted[0] ?? null;
  }, [db.contents]);

  const priorityStages = useMemo(() => priorityContent ? productionStagesFor(priorityContent) : [], [priorityContent]);
  const completedPriorityStages = priorityStages.filter((stage) => stage.done).length;
  const priorityNext = priorityStages.find((stage) => !stage.done) ?? null;

  function updateForm<K extends keyof ContentForm>(key: K, value: ContentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleFormArray(key: "platforms" | "outputs", value: string) {
    setForm((current) => {
      const list = current[key] as string[];
      return { ...current, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] };
    });
  }

  function changeRecordingMode(mode: Exclude<RecordingMode, "未设置">) {
    setForm((current) => ({ ...current, recordingMode: mode, outputs: [...outputsByMode[mode]] }));
    setNotice(`已切换为${mode}，交付物已按录制流程调整。`);
  }

  function saveDraft() {
    if (!form.title.trim()) {
      setNotice("先写一个主标题，选题才能进入内容库。");
      return null;
    }
    const date = today();
    const existing = workingId ? db.contents.find((content) => content.id === workingId) : null;
    if (existing) {
      const briefChanged = existing.title !== form.title.trim() || existing.subtitle !== (form.subtitle.trim() || "副标题待完善") || existing.audience !== form.audience || existing.pain !== form.pain || existing.viewpoint !== form.viewpoint || existing.cases !== form.cases || existing.recordingMode !== form.recordingMode;
      setDb((current) => ({
        ...current,
        contents: current.contents.map((item) => item.id === existing.id ? {
          ...item,
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || "副标题待完善",
          audience: form.audience,
          pain: form.pain,
          viewpoint: form.viewpoint,
          cases: form.cases,
          platforms: form.platforms,
          outputs: form.outputs,
          recordingMode: form.recordingMode,
          productionPlan: productionPlanFor(form.recordingMode),
          draftState: briefChanged && item.draftState === "已确认" ? "编辑中" : item.draftState,
          htmlState: briefChanged && item.draftState === "已确认" ? "待生成" : item.htmlState,
          coverState: briefChanged && item.draftState === "已确认" ? "待生成" : item.coverState,
          publishingState: briefChanged && item.draftState === "已确认" ? "待生成" : item.publishingState,
          updatedAt: date,
        } : item),
      }));
      setSelectedId(existing.id);
      setNotice("当前选题已更新，可以继续在本页推进。 ");
      return existing.id;
    }
    const item: ContentItem = {
      id: uid("content"),
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || "副标题待完善",
      audience: form.audience,
      pain: form.pain,
      viewpoint: form.viewpoint,
      cases: form.cases,
      status: "待生成",
      platforms: form.platforms,
      outputs: form.outputs,
      recordingMode: form.recordingMode,
      productionPlan: productionPlanFor(form.recordingMode),
      createdAt: date,
      updatedAt: date,
      script: "",
      draftState: "未生成",
      htmlState: "未开始",
      coverState: "未开始",
      publishingState: "未开始",
      htmlStyle: "专业科技",
      coverStyle: "高对比科技",
      metrics: emptyMetrics(),
      origin: "工作站创作",
      publishedAt: "",
      publishLinks: {},
      archiveNotes: "",
      contentVersion: 0,
      acceptedRunId: "",
      latestRunId: "",
      latestRunStatus: "idle",
      contentVersions: [],
      htmlRunId: "",
      coverRunId: "",
      pendingHtmlRunId: "",
      pendingCoverRunId: "",
      htmlManifest: null,
      coverManifest: null,
      pendingHtmlManifest: null,
      pendingCoverManifest: null,
      publishingRunId: "",
      pendingPublishingRunId: "",
      publishingManifest: null,
      pendingPublishingManifest: null,
    };
    setDb((current) => ({ ...current, contents: [item, ...current.contents] }));
    setSelectedId(item.id);
    setWorkingId(item.id);
    setNotice("选题已保存，并已开启本期制作流程。 ");
    return item.id;
  }

  function startNewContent() {
    setForm({ ...initialForm, audience: db.settings.audience, platforms: [...db.settings.defaultPlatforms] });
    setWorkingId(null);
    setScoutTopic("");
    setTopicAngles([]);
    setAnglesError("");
    navigate("create");
  }

  function continueInCreate(item: ContentItem) {
    setForm({
      title: item.title,
      subtitle: item.subtitle === "副标题待完善" ? "" : item.subtitle,
      whyNow: "",
      audience: item.audience,
      pain: item.pain,
      viewpoint: item.viewpoint,
      sources: "",
      cases: item.cases,
      duration: "5–8 分钟",
      platforms: [...item.platforms],
      outputs: [...item.outputs],
      recordingMode: item.recordingMode === "未设置" ? "混合录制" : item.recordingMode,
    });
    setWorkingId(item.id);
    setView("create");
    setSelectedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openContentTask() {
    const contentId = saveDraft();
    if (!contentId) return;
    void startContentGeneration(contentId, {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      whyNow: form.whyNow,
      audience: form.audience,
      pain: form.pain,
      viewpoint: form.viewpoint,
      sources: form.sources,
      cases: form.cases,
      duration: form.duration,
      platforms: form.platforms,
      outputs: form.outputs,
      recordingMode: form.recordingMode,
      productionPlan: productionPlanFor(form.recordingMode),
    });
  }

  async function refreshBridgeRuns() {
    const { runs } = await listBridgeRuns();
    setBridgeRuns(runs);
    return runs;
  }

  async function checkCodexConnection() {
    setDoctorLoading(true);
    setBridgeState("checking");
    try {
      const health = await connectLocalBridge();
      setBridgeInfo({ version: health.version, activeRuns: health.activeRuns });
      setBridgeState("connected");
      const [report] = await Promise.all([runBridgeDoctor(), refreshBridgeRuns()]);
      setDoctorReport(report);
    } catch (error) {
      setBridgeState("offline");
      setDoctorReport(null);
      setNotice(error instanceof Error ? error.message : "无法连接本机 Codex Bridge。");
    } finally {
      setDoctorLoading(false);
    }
  }

  async function reconnectBridge(recoverRuns = false) {
    setBridgeState("checking");
    try {
      const health = await connectLocalBridge();
      setBridgeInfo({ version: health.version, activeRuns: health.activeRuns });
      setBridgeState("connected");
      const runs = await refreshBridgeRuns();
      if (!recoverRuns) return;
      const recoverable = runs.find((run) => run.status === "queued" || run.status === "running");
      if (recoverable) {
        if (recoverable.taskType === "research") void pollTopicResearchRun(recoverable);
        else if (recoverable.taskType === "angles") void pollTopicAnglesRun(recoverable);
        else if (recoverable.taskType === "content") void pollContentRun(recoverable);
        else void pollVisualRun(recoverable);
        return;
      }
      const unapplied = runs.find((run) => run.taskType === "content" && run.status === "completed" && db.contents.some((item) => item.id === run.contentId && !item.contentVersions.some((version) => version.runId === run.runId)));
      if (unapplied) void pollContentRun(unapplied);
      const unfinishedVisual = runs.find((run) => (run.taskType === "html" || run.taskType === "cover" || run.taskType === "publishing") && run.status === "completed" && db.contents.some((item) => item.id === run.contentId && (item.pendingHtmlRunId === run.runId || item.pendingCoverRunId === run.runId || item.pendingPublishingRunId === run.runId) && !(item.pendingHtmlManifest || item.pendingCoverManifest || item.pendingPublishingManifest)));
      if (unfinishedVisual) void pollVisualRun(unfinishedVisual);
    } catch {
      setBridgeState("offline");
    }
  }

  async function startContentGeneration(contentId: string, contentBrief: Record<string, unknown>) {
    if (activeRun) {
      setNotice("当前已有 Codex 任务运行，请等待完成或先停止。 ");
      return;
    }
    const current = db.contents.find((item) => item.id === contentId);
    const nextVersion = (current?.contentVersion || 0) + 1;
    setDb((database) => ({
      ...database,
      contents: database.contents.map((item) => item.id === contentId ? {
        ...item,
        contentVersion: nextVersion,
        latestRunStatus: "queued",
        updatedAt: today(),
      } : item),
    }));
    let bridgeConnected = false;
    try {
      setBridgeState("checking");
      await connectLocalBridge();
      bridgeConnected = true;
      setBridgeState("connected");
      const { run } = await createContentRun({
        contentId,
        contentVersion: nextVersion,
        creatorContext: {
          name: db.settings.name,
          role: db.settings.role,
          experience: db.settings.experience,
          audience: db.settings.audience,
          voice: db.settings.style,
          goal: db.settings.goal,
          cases: db.cases.slice(0, 12),
        },
        contentBrief,
      });
      setDb((database) => ({
        ...database,
        contents: database.contents.map((item) => item.id === contentId ? { ...item, latestRunId: run.runId, latestRunStatus: run.status } : item),
      }));
      setNotice("Codex 已开始生成内容，完成后会自动回填。 ");
      await pollContentRun(run);
    } catch (error) {
      setBridgeState(bridgeConnected ? "connected" : "offline");
      setDb((database) => ({
        ...database,
        contents: database.contents.map((item) => item.id === contentId ? { ...item, latestRunStatus: "failed" } : item),
      }));
      setNotice(error instanceof Error ? error.message : "无法连接本机 Codex Bridge。 ");
    }
  }

  async function pollContentRun(initialRun: BridgeRun) {
    if (pollingRuns.current.has(initialRun.runId)) return;
    pollingRuns.current.add(initialRun.runId);
    let run = initialRun;
    setActiveRun(run);
    try {
      while (run.status === "queued" || run.status === "running") {
        setActiveRun(run);
        setDb((database) => ({
          ...database,
          contents: database.contents.map((item) => item.id === run.contentId ? { ...item, latestRunId: run.runId, latestRunStatus: run.status } : item),
        }));
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        ({ run } = await getBridgeRun(run.runId));
      }
      setActiveRun(run);
      if (run.status === "completed") {
        const result = await getContentResult(run.runId);
        const generatedVersion: ContentVersion = {
          version: run.contentVersion,
          runId: run.runId,
          createdAt: run.completedAt || new Date().toISOString(),
          subtitle: result.recommendedSubtitle,
          pain: result.audiencePain.join("\n"),
          viewpoint: result.coreThesis,
          script: result.script.fullMarkdown,
          state: "候选",
        };
        setDb((database) => ({
          ...database,
          contents: database.contents.map((item) => {
            if (item.id !== run.contentId || item.contentVersions.some((version) => version.runId === run.runId)) return item;
            const preserveConfirmed = item.draftState === "已确认";
            const versions = [
              { ...generatedVersion, state: preserveConfirmed ? "候选" as const : "已采用" as const },
              ...item.contentVersions.map((version) => preserveConfirmed ? version : { ...version, state: "候选" as const }),
            ];
            return {
              ...item,
              subtitle: preserveConfirmed ? item.subtitle : generatedVersion.subtitle || item.subtitle,
              pain: preserveConfirmed ? item.pain : generatedVersion.pain,
              viewpoint: preserveConfirmed ? item.viewpoint : generatedVersion.viewpoint,
              script: preserveConfirmed ? item.script : generatedVersion.script,
              draftState: preserveConfirmed ? item.draftState : "编辑中",
              acceptedRunId: preserveConfirmed ? item.acceptedRunId : run.runId,
              latestRunId: run.runId,
              latestRunStatus: "completed",
              contentVersions: versions,
              updatedAt: today(),
            };
          }),
        }));
        setNotice("内容生成完成，已回填为可编辑稿件。 ");
      } else {
        setDb((database) => ({
          ...database,
          contents: database.contents.map((item) => item.id === run.contentId ? { ...item, latestRunStatus: run.status } : item),
        }));
        setNotice(run.status === "cancelled" ? "内容生成已停止。" : run.error?.message || "内容生成未完成，请重试。 ");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "读取 Codex 结果失败。 ");
    } finally {
      pollingRuns.current.delete(initialRun.runId);
      setActiveRun((currentRun) => currentRun?.runId === initialRun.runId ? null : currentRun);
    }
  }

  async function startVisualGeneration(item: ContentItem, taskType: "html" | "cover" | "publishing") {
    if (item.draftState !== "已确认" || !item.script.trim()) {
      setNotice("请先确认内容稿，再生成视觉资产。 ");
      return;
    }
    if (activeRun) {
      setNotice("当前已有 Codex 任务运行，请等待完成或先停止。 ");
      return;
    }
    const missingAssets = taskType === "publishing" ? missingPublishingAssets(item) : [];
    if (missingAssets.length) {
      setNotice(`请先接受${missingAssets.join("与")}，再生成发布包。`);
      return;
    }
    if (taskType === "publishing" && item.platforms.length === 0) {
      setNotice("请先为本期内容选择至少一个发布平台。 ");
      return;
    }
    const packageLabel = publishingPackageLabel(item.platforms);
    const style = taskType === "html" ? htmlStyles[item.htmlStyle] : taskType === "cover" ? coverStyles[item.coverStyle] : { description: `仅根据已选择的${selectedPlatformNames(item.platforms)}生成发布包。` };
    const styleName = taskType === "html" ? item.htmlStyle : taskType === "cover" ? item.coverStyle : packageLabel;
    const styleConfig: Record<string, unknown> = {
      styleId: styleName,
      styleName,
      description: style.description,
      recordingMode: item.recordingMode,
      title: item.title,
      subtitle: item.subtitle,
    };
    if (taskType === "cover") {
      styleConfig.guidance = coverStyles[item.coverStyle].guidance || "遵循所选风格，同时保证瀑布流小图可读。";
      styleConfig.portraitMode = "approved-creator-asset-only";
      styleConfig.portraitAvailable = false;
      styleConfig.fallback = "topic-object";
      styleConfig.sizes = ["16:9", "4:3", "3:4"];
    }
    if (taskType === "publishing") {
      styleConfig.platforms = item.platforms;
      styleConfig.htmlStyle = item.htmlStyle;
      styleConfig.coverStyle = item.coverStyle;
      styleConfig.acceptedAssets = {
        html: item.htmlManifest ? { runId: item.htmlRunId, generationMode: item.htmlManifest.generationMode, artifacts: item.htmlManifest.artifacts.map((artifact) => artifact.path) } : null,
        covers: item.coverManifest ? { runId: item.coverRunId, generationMode: item.coverManifest.generationMode, artifacts: item.coverManifest.artifacts.map((artifact) => artifact.path), notes: item.coverManifest.notes } : null,
      };
      styleConfig.creator = { role: db.settings.role, audience: db.settings.audience, voice: db.settings.style, goal: db.settings.goal };
    }
    try {
      await connectLocalBridge();
      setBridgeState("connected");
      const { run } = await createVisualRun({
        contentId: item.id,
        taskType,
        contentVersion: Math.max(1, item.contentVersion),
        confirmedContent: `# ${item.title}\n\n${item.subtitle}\n\n${item.script}`,
        styleConfig,
      });
      setDb((database) => ({
        ...database,
        contents: database.contents.map((content) => content.id === item.id ? {
          ...content,
          ...(taskType === "html" ? { pendingHtmlRunId: run.runId, pendingHtmlManifest: null, htmlState: "待生成" as const } : taskType === "cover" ? { pendingCoverRunId: run.runId, pendingCoverManifest: null, coverState: "待生成" as const } : { pendingPublishingRunId: run.runId, pendingPublishingManifest: null, publishingState: "待生成" as const }),
          updatedAt: today(),
        } : content),
      }));
      setNotice(taskType === "html" ? "Codex 已开始生成 HTML 录屏页。" : taskType === "cover" ? "Codex 已开始生成三尺寸封面。 " : `Codex 已开始生成${packageLabel}。`);
      await pollVisualRun(run);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "视觉任务启动失败。 ");
    }
  }

  async function continueProductionRun(item: ContentItem, taskType: "html" | "cover" | "publishing", instruction: string) {
    const trimmed = instruction.trim();
    if (!trimmed) {
      setNotice("请先写清楚希望 Codex 修改什么。 ");
      return;
    }
    if (activeRun) {
      setNotice("当前已有 Codex 任务运行，请等待完成或先停止。 ");
      return;
    }
    const baseRunId = taskType === "html" ? (item.pendingHtmlRunId || item.htmlRunId) : taskType === "cover" ? (item.pendingCoverRunId || item.coverRunId) : (item.pendingPublishingRunId || item.publishingRunId);
    if (!baseRunId) {
      setNotice("请先生成第一版产物，再继续修改。 ");
      return;
    }
    try {
      await connectLocalBridge();
      setBridgeState("connected");
      const { run } = await continueBridgeRun(baseRunId, trimmed);
      setDb((database) => ({
        ...database,
        contents: database.contents.map((content) => content.id === item.id ? {
          ...content,
          ...(taskType === "html" ? { pendingHtmlRunId: run.runId, pendingHtmlManifest: null, htmlState: "待生成" as const } : taskType === "cover" ? { pendingCoverRunId: run.runId, pendingCoverManifest: null, coverState: "待生成" as const } : { pendingPublishingRunId: run.runId, pendingPublishingManifest: null, publishingState: "待生成" as const }),
          updatedAt: today(),
        } : content),
      }));
      setNotice("Codex 已在原任务上下文中继续修改。 ");
      await pollVisualRun(run);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "继续修改任务启动失败。 ");
    }
  }

  async function pollVisualRun(initialRun: BridgeRun) {
    if (pollingRuns.current.has(initialRun.runId)) return;
    pollingRuns.current.add(initialRun.runId);
    let run = initialRun;
    setActiveRun(run);
    try {
      while (run.status === "queued" || run.status === "running") {
        setActiveRun(run);
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        ({ run } = await getBridgeRun(run.runId));
      }
      setActiveRun(run);
      if (run.status === "completed") {
        const manifest = await getArtifactManifest(run.runId);
        setDb((database) => ({
          ...database,
          contents: database.contents.map((item) => item.id === run.contentId ? {
            ...item,
            ...(run.taskType === "html" ? { pendingHtmlRunId: run.runId, pendingHtmlManifest: manifest } : run.taskType === "cover" ? { pendingCoverRunId: run.runId, pendingCoverManifest: manifest } : { pendingPublishingRunId: run.runId, pendingPublishingManifest: manifest }),
            updatedAt: today(),
          } : item),
        }));
        const completedItem = db.contents.find((item) => item.id === run.contentId);
        setNotice(run.taskType === "html" ? "HTML 已生成，请预览后接受。" : run.taskType === "cover" ? `三尺寸封面已生成（${manifest.generationMode === "codex-template-render" ? "模板降级" : "图片混合生成"}），请预览后接受。` : `${publishingPackageLabel(completedItem?.platforms || [])}已生成，请检查后接受并下载。`);
      } else {
        setNotice(run.status === "cancelled" ? "视觉生成已停止。" : run.error?.message || "视觉生成未完成，请重试。 ");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "读取视觉产物失败。 ");
    } finally {
      pollingRuns.current.delete(initialRun.runId);
      setActiveRun((currentRun) => currentRun?.runId === initialRun.runId ? null : currentRun);
    }
  }

  function acceptVisualAsset(contentId: string, taskType: "html" | "cover" | "publishing") {
    setDb((database) => ({
      ...database,
      contents: database.contents.map((item) => {
        if (item.id !== contentId) return item;
        const pendingRunId = taskType === "html" ? item.pendingHtmlRunId : taskType === "cover" ? item.pendingCoverRunId : item.pendingPublishingRunId;
        const pendingManifest = taskType === "html" ? item.pendingHtmlManifest : taskType === "cover" ? item.pendingCoverManifest : item.pendingPublishingManifest;
        if (!pendingRunId || !pendingManifest) return item;
        return {
          ...item,
          ...(taskType === "html" ? { htmlRunId: pendingRunId, htmlManifest: pendingManifest, htmlState: "已生成" as const, pendingHtmlRunId: "", pendingHtmlManifest: null } : taskType === "cover" ? { coverRunId: pendingRunId, coverManifest: pendingManifest, coverState: "已生成" as const, pendingCoverRunId: "", pendingCoverManifest: null } : { publishingRunId: pendingRunId, publishingManifest: pendingManifest, publishingState: "已生成" as const, pendingPublishingRunId: "", pendingPublishingManifest: null, status: (["已录制", "已发布", "已复盘"] as ContentStatus[]).includes(item.status) ? item.status : "待录制" as const }),
          updatedAt: today(),
        };
      }),
    }));
    const acceptedItem = db.contents.find((item) => item.id === contentId);
    setNotice(taskType === "html" ? "HTML 录屏页已接受。" : taskType === "cover" ? "三尺寸封面已接受。 " : `${publishingPackageLabel(acceptedItem?.platforms || [])}已接受，可下载使用。`);
  }

  async function stopActiveRun() {
    if (!activeRun) return;
    try {
      const { run } = await cancelBridgeRun(activeRun.runId);
      setActiveRun(run);
      setBridgeRuns((current) => [run, ...current.filter((item) => item.runId !== run.runId)]);
      setNotice("正在停止 Codex 任务……");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "停止任务失败。 ");
    }
  }

  async function retryTask(runId: string) {
    if (activeRun) {
      setNotice("当前已有 Codex 任务运行，请等待完成或先停止。");
      return;
    }
    try {
      const { run } = await retryBridgeRun(runId);
      setBridgeRuns((current) => [run, ...current.filter((item) => item.runId !== run.runId)]);
      setNotice("已按原始输入重新提交任务。");
      if (run.taskType === "research") await pollTopicResearchRun(run);
      else if (run.taskType === "angles") await pollTopicAnglesRun(run);
      else if (run.taskType === "content") await pollContentRun(run);
      else await pollVisualRun(run);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "重新执行任务失败。");
    }
  }

  function generateForItem(item: ContentItem) {
    void startContentGeneration(item.id, {
      title: item.title,
      subtitle: item.subtitle,
      audience: item.audience,
      pain: item.pain,
      viewpoint: item.viewpoint,
      cases: item.cases,
      platforms: item.platforms,
      outputs: item.outputs,
      recordingMode: item.recordingMode,
      productionPlan: item.productionPlan,
    });
  }

  function applyContentVersion(contentId: string, runId: string) {
    setDb((database) => ({
      ...database,
      contents: database.contents.map((item) => {
        if (item.id !== contentId) return item;
        const version = item.contentVersions.find((candidate) => candidate.runId === runId);
        if (!version) return item;
        return {
          ...item,
          subtitle: version.subtitle || item.subtitle,
          pain: version.pain,
          viewpoint: version.viewpoint,
          script: version.script,
          draftState: "编辑中",
          acceptedRunId: runId,
          contentVersions: item.contentVersions.map((candidate) => ({ ...candidate, state: candidate.runId === runId ? "已采用" : "候选" })),
          htmlState: item.htmlState === "已生成" ? "待生成" : item.htmlState,
          coverState: item.coverState === "已生成" ? "待生成" : item.coverState,
          publishingState: item.publishingState === "已生成" ? "待生成" : item.publishingState,
          updatedAt: today(),
        };
      }),
    }));
    setNotice("已切换到所选内容版本，请检查后重新确认。 ");
  }

  async function startTopicResearch() {
    const topic = scoutTopic.trim();
    setResearchOpen(true);
    if (!topic) {
      setResearchError("请先输入一个具体议题。");
      return;
    }
    if (activeRun) {
      setResearchError("当前已有 Codex 任务运行，请等待完成或先停止。");
      return;
    }
    setResearchLoading(true);
    setResearchError("");
    setResearchResult(null);
    let bridgeConnected = false;
    try {
      const health = await connectLocalBridge();
      bridgeConnected = true;
      setBridgeInfo({ version: health.version, activeRuns: health.activeRuns });
      setBridgeState("connected");
      const { run } = await createTopicResearchRun({
        contentId: uid("research"),
        contentVersion: 1,
        creatorContext: {
          name: db.settings.name,
          role: db.settings.role,
          experience: db.settings.experience,
          audience: db.settings.audience,
          voice: db.settings.style,
          goal: db.settings.goal,
          cases: db.cases.slice(0, 8),
        },
        contentBrief: {
          topic,
          platforms: ["B站", "小红书", "视频号"],
          recency: "优先近12个月",
          sampleTarget: "每个平台最多10条；只记录实际找到且可核验的样本",
          purpose: "识别常见角度、内容空白，并推荐三个适合当前账号的切口",
        },
      });
      setBridgeRuns((current) => [run, ...current.filter((item) => item.runId !== run.runId)]);
      setNotice("Codex 已开始联网调研，完成后会自动展示来源和建议切口。");
      await pollTopicResearchRun(run);
    } catch (error) {
      if (!bridgeConnected) setBridgeState("offline");
      setResearchError(error instanceof Error ? error.message : "联网调研任务启动失败。");
      setResearchLoading(false);
    }
  }

  async function pollTopicResearchRun(initialRun: BridgeRun) {
    if (pollingRuns.current.has(initialRun.runId)) return;
    pollingRuns.current.add(initialRun.runId);
    let run = initialRun;
    setResearchOpen(true);
    setResearchLoading(true);
    setResearchError("");
    setActiveRun(run);
    try {
      while (run.status === "queued" || run.status === "running") {
        setActiveRun(run);
        setBridgeRuns((current) => [run, ...current.filter((item) => item.runId !== run.runId)]);
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        ({ run } = await getBridgeRun(run.runId));
      }
      setActiveRun(run);
      if (run.status === "completed") {
        const result = await getTopicResearchResult(run.runId);
        setResearchResult(result);
        setTopicAngles(result.recommendedAngles);
        setNotice("联网调研完成，已整理来源、内容空白和三个建议切口。");
      } else {
        const message = run.status === "cancelled" ? "联网调研已停止。" : run.error?.message || "联网调研未完成，请重试。";
        setResearchError(message);
        setNotice(message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取联网调研结果失败。";
      setResearchError(message);
      setNotice(message);
    } finally {
      pollingRuns.current.delete(initialRun.runId);
      setResearchLoading(false);
      setActiveRun((currentRun) => currentRun?.runId === initialRun.runId ? null : currentRun);
      void refreshBridgeRuns().catch(() => {});
    }
  }

  async function copyForWechat() {
    if (!scoutTopic.trim()) {
      setNotice("先填写一个想调研的议题。");
      return;
    }
    try {
      await navigator.clipboard.writeText(scoutTopic.trim());
      setNotice("关键词已复制，请在微信“搜一搜”中选择视频号查看。");
    } catch {
      setNotice("请复制议题后，在微信“搜一搜”中选择视频号。");
    }
  }

  async function generateTopicAngles() {
    const topic = scoutTopic.trim();
    if (!topic) {
      setAnglesError("请先输入一个具体议题。");
      return;
    }
    if (activeRun) {
      setAnglesError("当前已有 Codex 任务运行，请等待完成或先停止。");
      return;
    }
    setAnglesLoading(true);
    setAnglesError("");
    setTopicAngles([]);
    let bridgeConnected = false;
    try {
      setBridgeState("checking");
      await connectLocalBridge();
      bridgeConnected = true;
      setBridgeState("connected");
      const { run } = await createTopicAnglesRun({
        contentId: uid("angles"),
        contentVersion: 1,
        creatorContext: {
          name: db.settings.name,
          role: db.settings.role,
          experience: db.settings.experience,
          audience: db.settings.audience,
          voice: db.settings.style,
          goal: db.settings.goal,
          cases: db.cases.slice(0, 8).map((item) => ({
            title: item.title,
            industry: item.industry,
            background: item.background,
            action: item.action,
            result: item.result,
            tags: item.tags,
          })),
        },
        contentBrief: {
          topic,
          purpose: "为后续自媒体内容生产推荐三个差异明确、能够落地的切入角度",
          constraint: "不虚构平台热度、搜索结论、个人项目经历或数据",
        },
      });
      setNotice("任务已提交给本机 Codex，完成后会自动显示 3 个角度。");
      await pollTopicAnglesRun(run);
    } catch (error) {
      setBridgeState(bridgeConnected ? "connected" : "offline");
      setAnglesError(error instanceof Error ? error.message : "无法连接本机 Codex Bridge。");
      setAnglesLoading(false);
    }
  }

  async function pollTopicAnglesRun(initialRun: BridgeRun) {
    if (pollingRuns.current.has(initialRun.runId)) return;
    pollingRuns.current.add(initialRun.runId);
    let run = initialRun;
    setAnglesLoading(true);
    setAnglesError("");
    setActiveRun(run);
    try {
      while (run.status === "queued" || run.status === "running") {
        setActiveRun(run);
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        ({ run } = await getBridgeRun(run.runId));
      }
      setActiveRun(run);
      if (run.status === "completed") {
        const result = await getTopicAnglesResult(run.runId);
        if (!Array.isArray(result.angles) || result.angles.length !== 3) {
          throw new Error("Codex 返回的角度数量不正确，请重新生成。");
        }
        setTopicAngles(result.angles);
        setNotice("本机 Codex 已生成 3 个动态选题角度。");
      } else {
        const message = run.status === "cancelled" ? "选题角度生成已停止。" : run.error?.message || "选题角度生成未完成，请重试。";
        setAnglesError(message);
        setNotice(message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取 Codex 选题角度失败。";
      setAnglesError(message);
      setNotice(message);
    } finally {
      pollingRuns.current.delete(initialRun.runId);
      setAnglesLoading(false);
      setActiveRun((currentRun) => currentRun?.runId === initialRun.runId ? null : currentRun);
    }
  }

  function applyAngle(angle: TopicAngle) {
    setForm((current) => ({ ...current, title: angle.title, viewpoint: angle.viewpoint, whyNow: current.whyNow || `围绕“${scoutTopic.trim()}”的同类内容不少，但多数停留在概念介绍，需要补充真实项目中的判断方式。` }));
    setNotice("推荐角度已带入选题简报，你可以继续修改。");
    document.getElementById("content-brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changeStatus(id: string, status: ContentStatus) {
    setDb((current) => ({
      ...current,
      contents: current.contents.map((item) => (item.id === id ? { ...item, status, updatedAt: today() } : item)),
    }));
  }

  function changeContentRecordingMode(id: string, mode: Exclude<RecordingMode, "未设置">) {
    setDb((current) => ({
      ...current,
      contents: current.contents.map((item) => item.id === id ? {
        ...item,
        recordingMode: mode,
        productionPlan: productionPlanFor(mode),
        outputs: Array.from(new Set([...item.outputs, ...outputsByMode[mode]])),
        publishingState: item.publishingState === "已生成" ? "待生成" : item.publishingState,
        updatedAt: today(),
      } : item),
    }));
    setNotice(`已将这条内容设置为${mode}。`);
  }

  function updateContentScript(id: string, script: string) {
    setDb((current) => ({
      ...current,
      contents: current.contents.map((item) => item.id === id ? {
        ...item,
        script,
        draftState: item.draftState === "已确认" ? "编辑中" : script.trim() ? "编辑中" : "未生成",
        htmlState: item.draftState === "已确认" ? "待生成" : item.htmlState,
        coverState: item.draftState === "已确认" ? "待生成" : item.coverState,
        publishingState: item.draftState === "已确认" ? "待生成" : item.publishingState,
        updatedAt: today(),
      } : item),
    }));
  }

  function confirmContentScript(id: string) {
    const item = db.contents.find((content) => content.id === id);
    if (!item?.script.trim()) {
      setNotice("请先粘贴或编辑完整内容稿，再确认。 ");
      return;
    }
    setDb((current) => ({
      ...current,
      contents: current.contents.map((content) => content.id === id ? {
        ...content,
        draftState: "已确认",
        status: "已生成",
        htmlState: content.htmlState === "未开始" ? "待生成" : content.htmlState,
        coverState: content.coverState === "未开始" ? "待生成" : content.coverState,
        publishingState: content.publishingState === "未开始" ? "待生成" : content.publishingState,
        updatedAt: today(),
      } : content),
    }));
    setNotice("内容稿已确认，现在可以制作 HTML、封面和发布包。 ");
  }

  function updateHtmlStyle(id: string, style: HtmlStyle) {
    setDb((current) => ({ ...current, contents: current.contents.map((item) => {
      if (item.id !== id || item.htmlStyle === style) return item;
      return {
        ...item,
        htmlStyle: style,
        htmlState: item.htmlState === "已生成" ? "待生成" : item.htmlState,
        htmlRunId: "",
        htmlManifest: null,
        publishingState: item.publishingState === "已生成" ? "待生成" : item.publishingState,
        publishingRunId: "",
        publishingManifest: null,
        updatedAt: today(),
      };
    }) }));
  }

  function updateCoverStyle(id: string, style: CoverStyle) {
    setDb((current) => ({ ...current, contents: current.contents.map((item) => {
      if (item.id !== id || item.coverStyle === style) return item;
      return {
        ...item,
        coverStyle: style,
        coverState: item.coverState === "已生成" ? "待生成" : item.coverState,
        coverRunId: "",
        coverManifest: null,
        publishingState: item.publishingState === "已生成" ? "待生成" : item.publishingState,
        publishingRunId: "",
        publishingManifest: null,
        updatedAt: today(),
      };
    }) }));
  }

  function updateMetric(id: string, platform: Platform, field: keyof Omit<Metric, "platform">, value: number) {
    setDb((current) => ({
      ...current,
      contents: current.contents.map((item) =>
        item.id === id
          ? { ...item, updatedAt: today(), metrics: item.metrics.map((metric) => (metric.platform === platform ? { ...metric, [field]: value } : metric)) }
          : item,
      ),
    }));
  }

  function updateContentMetadata(id: string, patch: Partial<Pick<ContentItem, "title" | "subtitle" | "publishedAt" | "publishLinks" | "archiveNotes" | "viewpoint">>) {
    setDb((current) => ({
      ...current,
      contents: current.contents.map((item) => item.id === id ? { ...item, ...patch, updatedAt: today() } : item),
    }));
  }

  function toggleHistoryPlatform(platform: Platform) {
    setHistoryForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform) ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform],
    }));
  }

  function updateHistoryMetric(platform: Platform, field: keyof Omit<Metric, "platform">, value: number) {
    setHistoryForm((current) => ({
      ...current,
      metrics: current.metrics.map((metric) => metric.platform === platform ? { ...metric, [field]: value } : metric),
    }));
  }

  function addHistoricalContent() {
    if (!historyForm.title.trim()) {
      setNotice("请先填写历史内容标题。");
      return;
    }
    if (!historyForm.platforms.length) {
      setNotice("请至少选择一个发布平台。");
      return;
    }
    const date = today();
    const item: ContentItem = {
      id: uid("archive"),
      title: historyForm.title.trim(),
      subtitle: historyForm.subtitle.trim() || "历史内容",
      audience: "历史内容，受众待补充",
      pain: "",
      viewpoint: historyForm.viewpoint.trim(),
      cases: "",
      status: "已发布",
      platforms: historyForm.platforms,
      outputs: [],
      recordingMode: historyForm.recordingMode,
      productionPlan: historyForm.recordingMode === "未设置" ? "历史内容，制作方式待补充" : productionPlanFor(historyForm.recordingMode),
      createdAt: historyForm.publishedAt || date,
      updatedAt: date,
      script: historyForm.script,
      draftState: historyForm.script.trim() ? "已确认" : "未生成",
      htmlState: "未开始",
      coverState: "未开始",
      publishingState: "未开始",
      htmlStyle: "专业科技",
      coverStyle: "高对比科技",
      metrics: historyForm.metrics,
      origin: "历史归档",
      publishedAt: historyForm.publishedAt,
      publishLinks: historyForm.publishLinks,
      archiveNotes: historyForm.archiveNotes,
      contentVersion: 0,
      acceptedRunId: "",
      latestRunId: "",
      latestRunStatus: "idle",
      contentVersions: [],
      htmlRunId: "",
      coverRunId: "",
      pendingHtmlRunId: "",
      pendingCoverRunId: "",
      htmlManifest: null,
      coverManifest: null,
      pendingHtmlManifest: null,
      pendingCoverManifest: null,
      publishingRunId: "",
      pendingPublishingRunId: "",
      publishingManifest: null,
      pendingPublishingManifest: null,
    };
    setDb((current) => ({ ...current, contents: [item, ...current.contents] }));
    setSelectedId(item.id);
    setHistoryForm(initialHistoryForm());
    setHistoryOpen(false);
    setNotice("历史内容已归档，可在右侧继续维护资料和平台数据。");
  }

  function addCase() {
    if (!caseDraft.title.trim()) {
      setNotice("请先填写案例名称。");
      return;
    }
    const item: CaseItem = {
      id: uid("case"),
      title: caseDraft.title.trim(),
      industry: caseDraft.industry.trim() || "待分类",
      background: caseDraft.background.trim() || "背景待补充",
      action: "关键动作待补充",
      result: caseDraft.result.trim() || "结果待补充",
      tags: ["个人经历"],
    };
    setDb((current) => ({ ...current, cases: [item, ...current.cases] }));
    setCaseDraft({ title: "", industry: "", background: "", result: "" });
    setNotice("案例已加入素材库。");
  }

  function deleteContent(id: string) {
    const item = db.contents.find((content) => content.id === id);
    if (!item) return;
    const confirmed = window.confirm(`确认删除《${item.title}》？\n\n内容稿、视觉制作状态和已录入的平台数据都会一起删除，且无法恢复。`);
    if (!confirmed) return;
    setDb((current) => ({ ...current, contents: current.contents.filter((content) => content.id !== id) }));
    if (selectedId === id) setSelectedId(null);
    if (workingId === id) setWorkingId(null);
    setNotice(`已删除《${item.title}》。`);
  }

  function deleteCase(id: string) {
    const item = db.cases.find((caseItem) => caseItem.id === id);
    if (!item) return;
    const confirmed = window.confirm(`确认删除案例“${item.title}”？\n\n删除后不会自动修改已经引用它的历史内容。`);
    if (!confirmed) return;
    setDb((current) => ({ ...current, cases: current.cases.filter((caseItem) => caseItem.id !== id) }));
    setNotice(`已删除案例“${item.title}”。`);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `content-workstation-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("数据备份已导出。");
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Database;
        if (!parsed.contents || !parsed.cases || !parsed.settings) throw new Error("invalid");
        setDb(normalizeDatabase(parsed));
        setNotice("数据已导入。");
      } catch {
        setNotice("导入失败：文件不是有效的工作台备份。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function clearAllContent() {
    const total = db.contents.length + db.cases.length;
    if (!total) {
      setNotice("当前没有内容或案例需要清空。");
      return;
    }
    const confirmed = window.confirm(`确认清空全部内容与案例？\n\n将删除 ${db.contents.length} 条内容和 ${db.cases.length} 条案例。账号设置会保留，此操作无法恢复。`);
    if (!confirmed) return;
    setDb((current) => ({ ...current, contents: [], cases: [] }));
    setSelectedId(null);
    setWorkingId(null);
    setNotice("已清空全部内容、案例和对应运营数据；账号设置已保留。");
  }

  function navigate(next: View) {
    setView(next);
    setSelectedId(null);
    if (next === "tasks") void refreshBridgeRuns().catch(() => setBridgeState("offline"));
    if (next === "settings") void checkCodexConnection();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("dashboard")} aria-label="回到工作台">
          <span className="brand-mark">P.</span>
          <span><strong>内容工作站</strong><small>CONTENT WORKSTATION</small></span>
        </button>
        <nav aria-label="主导航">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span><small>{item.eyebrow}</small>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" /> 本地工作模式
          <p>内容与任务保存在本机工作站中，请定期导出备份。</p>
        </div>
        <div className="profile-mini">
          <span className="avatar">{db.settings.name.trim().slice(0, 1) || "创"}</span>
          <span><strong>{db.settings.name}</strong><small>{db.settings.role || "本地内容创作者"}</small></span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">{viewCopy[view].eyebrow}</span>
            <h1>{viewCopy[view].title}</h1>
            <p>{viewCopy[view].description}</p>
          </div>
          <div className="topbar-actions"><button className={`bridge-chip bridge-${bridgeState}`} onClick={() => void reconnectBridge()}><i />{bridgeState === "connected" ? "Codex 已连接" : bridgeState === "checking" ? "正在检查 Codex" : "Codex 未连接"}</button><button className="primary-button top-create" onClick={startNewContent}><span>＋</span> 新建一期内容</button></div>
        </header>

        {view === "dashboard" && (
          <section className="page-grid">
            <div className="hero-card span-8">
              <div className="hero-copy">
                <span className="pill dark">本周优先事项</span>
                <h2>{priorityContent ? `继续推进「${priorityContent.title}」` : "先创建第一期内容"}</h2>
                <p>{priorityContent ? priorityNext ? `当前下一步：${priorityNext.title}。${priorityNext.description}` : "这期内容的制作节点已经全部完成，可以进入数据复盘。" : "目前内容库为空。先建立一个选题简报，工作台会根据真实状态提示下一步。"}</p>
                <div className="button-row">
                  {priorityContent ? <button className="light-button" onClick={() => continueInCreate(priorityContent)}>继续当前制作</button> : <button className="light-button" onClick={startNewContent}>新建第一期内容</button>}
                  <button className="ghost-button" onClick={startNewContent}>准备下一期 →</button>
                </div>
              </div>
              <div className="hero-score"><strong>{completedPriorityStages}/{priorityStages.length || 6}</strong><span>真实制作节点</span><div className="progress"><i style={{ width: `${priorityStages.length ? (completedPriorityStages / priorityStages.length) * 100 : 0}%` }} /></div></div>
            </div>

            <div className="metric-card span-4 accent-card">
              <span className="card-label">累计播放</span>
              <strong>{formatNumber(totals.views)}</strong>
              <p>{totals.views ? "来自已录入的平台数据" : "暂无已录入播放数据"}</p>
              <span className="metric-mark">↗</span>
            </div>

            <div className="metric-card span-3"><span className="card-label">内容项目</span><strong>{db.contents.length}</strong><p>{db.contents.filter((c) => c.status === "已发布" || c.status === "已复盘").length} 条已发布</p></div>
            <div className="metric-card span-3"><span className="card-label">累计收藏</span><strong>{formatNumber(totals.saves)}</strong><p>{totals.views ? ((totals.saves / totals.views) * 100).toFixed(1) : 0}% 收藏率</p></div>
            <div className="metric-card span-3"><span className="card-label">新增关注</span><strong>{formatNumber(totals.follows)}</strong><p>来自内容转化</p></div>
            <div className="metric-card span-3"><span className="card-label">实战案例</span><strong>{db.cases.length}</strong><p>可复用表达素材</p></div>

            <div className="panel span-7">
              <div className="panel-heading"><div><span className="eyebrow">PIPELINE</span><h2>最近内容</h2></div><button className="text-button" onClick={() => navigate("library")}>查看全部 →</button></div>
              <div className="content-list">
                {db.contents.slice(0, 4).map((item) => (
                  <button className="content-row" key={item.id} onClick={() => { setSelectedId(item.id); setView("library"); }}>
                    <span className={`status-dot status-${statuses.indexOf(item.status)}`} />
                    <span className="content-row-main"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                    <span className="platform-mini">{item.platforms.slice(0, 3).join(" · ")}</span>
                    <span className="status-badge">{item.status}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel span-5">
              <div className="panel-heading"><div><span className="eyebrow">NEXT ACTION</span><h2>按这个顺序推进</h2></div></div>
              <ol className="next-list">
                {priorityStages.length ? priorityStages.map((stage, index) => <li className={stage.done ? "done" : priorityNext?.title === stage.title ? "current" : ""} key={`${stage.title}-${index}`}><span>{index + 1}</span><div><strong>{stage.title}</strong><small>{stage.description}</small></div></li>) : <li className="current"><span>1</span><div><strong>新建第一期内容</strong><small>工作台会从真实项目状态生成后续步骤</small></div></li>}
              </ol>
            </div>
          </section>
        )}

        {view === "create" && (
          <section className="create-layout">
            <div className="form-stack">
              <div className="topic-scout">
                <div className="scout-heading">
                  <div><span className="eyebrow">TOPIC RADAR</span><h2>先看看别人怎么讲，再决定你讲什么</h2><p>平台检索找同类，Codex 结合账号资料实时生成差异化切入角度。</p></div>
                  <span className="beta-badge">选题推荐 · BETA</span>
                </div>
                <div className="scout-search">
                  <label><span>想调研的议题</span><span className="scout-input-row"><input value={scoutTopic} onChange={(e) => { setScoutTopic(e.target.value); setTopicAngles([]); setAnglesError(""); }} onKeyDown={(e) => { if (e.key === "Enter") void generateTopicAngles(); }} placeholder="例如：产品经理如何做 Agent 需求判断" /><button type="button" className="generate-angle-button" onClick={() => void generateTopicAngles()} disabled={!scoutTopic.trim() || anglesLoading}>{anglesLoading ? "Codex 生成中…" : "Codex 生成 3 个角度"}</button></span></label>
                  <div className="scout-actions">
                    <a className={`platform-search ${!scoutTopic.trim() ? "disabled" : ""}`} href={scoutTopic.trim() ? `https://search.bilibili.com/all?keyword=${encodeURIComponent(scoutTopic.trim())}` : undefined} target="_blank" rel="noreferrer"><strong>B</strong><span>查 B站<small>打开关键词搜索</small></span></a>
                    <a className={`platform-search red ${!scoutTopic.trim() ? "disabled" : ""}`} href={scoutTopic.trim() ? `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(scoutTopic.trim())}` : undefined} target="_blank" rel="noreferrer"><strong>RED</strong><span>查小红书<small>可能需要登录</small></span></a>
                    <button className="platform-search green" onClick={copyForWechat} disabled={!scoutTopic.trim()}><strong>微</strong><span>查视频号<small>复制词去搜一搜</small></span></button>
                    <button className="platform-search codex" onClick={() => void startTopicResearch()} disabled={!scoutTopic.trim() || researchLoading}><strong>✦</strong><span>{researchLoading ? "Codex 调研中" : "交给 Codex"}<small>{researchLoading ? "可打开查看实时状态" : "联网归纳同类选题"}</small></span></button>
                  </div>
                  <ol className="scout-flow" aria-label="选题调研下一步">
                    <li className={scoutTopic.trim() ? "done" : "current"}><span>1</span><p><strong>输入议题</strong><small>先写你想研究的问题</small></p></li>
                    <li className={scoutTopic.trim() ? "current" : ""}><span>2</span><p><strong>查看同类</strong><small>每个平台先看 5～10 条</small></p></li>
                    <li><span>3</span><p><strong>Codex 归纳</strong><small>找高频角度与内容空白</small></p></li>
                    <li><span>4</span><p><strong>确定切口</strong><small>带入简报并补真实案例</small></p></li>
                  </ol>
                </div>
                {anglesLoading && <TopicAngleGenerationStatus run={activeRun?.taskType === "angles" ? activeRun : null} onCancel={() => void stopActiveRun()} />}
                {anglesError && <div className="angle-error"><strong>暂时无法生成</strong><p>{anglesError}</p><small>请确认设置页显示“Codex 已连接”，并确保当前没有其他 Codex 任务运行。</small></div>}
                {topicAngles.length > 0 && <div className="angle-results"><div className="angle-title"><strong>本机 Codex 生成的 3 个切入角度</strong><span>基于当前议题、账号资料与案例库</span></div><div className="angle-grid dynamic">{topicAngles.map((angle) => <article key={`${angle.type}-${angle.title}`}><span>{angle.type}</span><h3>{angle.title}</h3><p>{angle.viewpoint}</p><dl><div><dt>受众痛点</dt><dd>{angle.audiencePain}</dd></div><div><dt>内容价值</dt><dd>{angle.contentValue}</dd></div><div><dt>需要证据</dt><dd>{angle.evidenceNeeded}</dd></div></dl><button onClick={() => applyAngle(angle)}>用这个角度写 →</button></article>)}</div></div>}
                <div className="feasibility-note"><strong>当前能力边界</strong><p>三个角度由本机 Codex 结合议题、账号资料和案例库实时生成，不再需要 DeepSeek 或 OpenAI API Key。联网调研只保留实际找到且可核验的公开来源；需要登录或无法访问的平台会明确留空，并给出人工补充步骤。</p></div>
              </div>

              <div className="form-section" id="content-brief">
                <div className="section-number">01</div>
                <div className="section-copy"><h2>这期到底要讲什么</h2><p>标题可以先粗糙，但痛点和你的判断要具体。</p></div>
                <div className="fields two-col">
                  <label>主标题<input value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="例如：传统产品转型 AI 产品，先搞懂这几件事" /></label>
                  <label>副标题<input value={form.subtitle} onChange={(e) => updateForm("subtitle", e.target.value)} placeholder="可留空，让 Codex 提供候选" /></label>
                  <label className="full">为什么现在值得讲<textarea value={form.whyNow} onChange={(e) => updateForm("whyNow", e.target.value)} placeholder="最近看到了什么误区、变化或真实问题？" /></label>
                  <label className="full">目标人群<input value={form.audience} onChange={(e) => updateForm("audience", e.target.value)} /></label>
                  <label>他们现在卡在哪里<textarea value={form.pain} onChange={(e) => updateForm("pain", e.target.value)} placeholder="不要写‘认知不足’，描述一个真实工作场景" /></label>
                  <label>你最想说的判断<textarea value={form.viewpoint} onChange={(e) => updateForm("viewpoint", e.target.value)} placeholder="如果观众只记住一句话，希望是哪一句？" /></label>
                </div>
              </div>

              <div className="form-section">
                <div className="section-number">02</div>
                <div className="section-copy"><h2>拿什么证明这不是空谈</h2><p>经历、冲突和结果，比“正确观点”更容易建立信任。</p></div>
                <div className="fields two-col">
                  <label>参考材料<textarea value={form.sources} onChange={(e) => updateForm("sources", e.target.value)} placeholder="HTML、文档、链接或已有笔记的位置" /></label>
                  <label>准备讲的亲身案例<textarea value={form.cases} onChange={(e) => updateForm("cases", e.target.value)} placeholder="背景 → 当时的难题 → 你怎么判断 → 结果" /></label>
                </div>
                <div className="case-suggestions">
                  <span>从案例库带入：</span>
                  {db.cases.slice(0, 3).map((item) => <button key={item.id} onClick={() => updateForm("cases", `${form.cases}${form.cases ? "\n" : ""}${item.title}：${item.background}`)}>＋ {item.title}</button>)}
                </div>
              </div>

              <div className="form-section">
                <div className="section-number">03</div>
                <div className="section-copy"><h2>决定这期怎么讲</h2><p>这里先确定内容和录制方式；视觉风格等内容确认后再选择。</p></div>
                <div className="fields two-col">
                  <fieldset className="full"><legend>呈现方式</legend><div className="recording-grid">{recordingModes.map((mode) => {
                    const copy = recordingModeCopy[mode];
                    return <label className={`recording-card ${form.recordingMode === mode ? "selected" : ""}`} key={mode}><input type="radio" name="recording-mode" checked={form.recordingMode === mode} onChange={() => changeRecordingMode(mode)} /><span className="recording-icon">{copy.icon}</span><span className="recording-copy"><strong>{copy.title}{mode === "混合录制" && <i>推荐</i>}</strong><small>{copy.description}</small><em>适合：{copy.bestFor}</em></span></label>;
                  })}</div><div className="recording-plan-preview"><span>当前制作结构</span><p>{productionPlanFor(form.recordingMode)}</p></div></fieldset>
                  <label>视频时长<select value={form.duration} onChange={(e) => updateForm("duration", e.target.value)}><option>60–90 秒</option><option>3–5 分钟</option><option>5–8 分钟</option><option>8–12 分钟</option></select></label>
                  <fieldset><legend>发布平台</legend><div className="check-grid">{platforms.map((item) => <label className="check-card" key={item}><input type="checkbox" checked={form.platforms.includes(item)} onChange={() => toggleFormArray("platforms", item)} /><span>{item}</span></label>)}</div></fieldset>
                </div>
                <ol className="stage-flow">
                  <li className="active"><span>1</span><p><strong>生成内容草稿</strong><small>标题、口播、时间轴和发布文案</small></p></li>
                  <li><span>2</span><p><strong>查看、编辑、确认</strong><small>确认之前不生成视觉资产</small></p></li>
                  <li><span>3</span><p><strong>选择两类风格</strong><small>HTML 与封面可以选择不同风格</small></p></li>
                  <li><span>4</span><p><strong>分别生成</strong><small>HTML 和三尺寸封面互不绑定</small></p></li>
                </ol>
              </div>

              <div className="form-actions"><button className="secondary-button" onClick={saveDraft}>{workingContent ? "更新当前选题" : "保存选题草稿"}</button><button className="primary-button" onClick={openContentTask} disabled={Boolean(activeRun)}>{activeRun ? "Codex 正在生成…" : "使用 Codex 生成内容 →"}</button></div>
              {workingContent && <InlineCreationWorkflow
                item={workingContent}
                activeRun={activeRun?.contentId === workingContent.id ? activeRun : null}
                onScript={(script) => updateContentScript(workingContent.id, script)}
                onConfirm={() => confirmContentScript(workingContent.id)}
                onGenerate={() => generateForItem(workingContent)}
                onCancel={() => void stopActiveRun()}
                onApplyVersion={(runId) => applyContentVersion(workingContent.id, runId)}
                onHtmlStyle={(style) => updateHtmlStyle(workingContent.id, style)}
                onCoverStyle={(style) => updateCoverStyle(workingContent.id, style)}
                onGenerateVisual={(kind) => void startVisualGeneration(workingContent, kind)}
                onAcceptVisual={(kind) => acceptVisualAsset(workingContent.id, kind)}
                onContinueVisual={(kind, instruction) => void continueProductionRun(workingContent, kind, instruction)}
              />}
            </div>

            <aside className="brief-preview">
              <span className="eyebrow">BRIEF CHECK</span><h3>内容生成前检查</h3>
              <ul>
                <li className={form.title ? "ok" : ""}><span>{form.title ? "✓" : "1"}</span>选题是否具体</li>
                <li className={form.pain ? "ok" : ""}><span>{form.pain ? "✓" : "2"}</span>痛点是否像真实场景</li>
                <li className={form.viewpoint ? "ok" : ""}><span>{form.viewpoint ? "✓" : "3"}</span>是否有你的明确判断</li>
                <li className={form.cases ? "ok" : ""}><span>{form.cases ? "✓" : "4"}</span>是否有亲身案例</li>
              </ul>
              <div className="brief-tip"><strong>一个实用判断</strong><p>如果这四项只有标题填得最完整，AI 生成出来大概率还是一篇“正确但没感觉”的稿子。</p></div>
            </aside>
          </section>
        )}

        {view === "library" && (
          <section>
            <div className="toolbar">
              <label className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索标题、观点或关键词" /></label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ContentStatus | "全部")}><option>全部</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
              <span className="result-count">{filteredContents.length} 条内容</span>
              <button className="secondary-button archive-entry" onClick={() => setHistoryOpen(true)}>＋ 归档历史内容</button>
            </div>
            <div className="library-layout">
              <div className="library-grid">
                {!filteredContents.length && <div className="empty-state"><strong>还没有内容</strong><p>从“新建内容”开始创建第一期，后续稿件和视觉制作会同步到这里。</p><button className="primary-button" onClick={startNewContent}>新建第一期内容</button></div>}
                {filteredContents.map((item) => {
                  const itemViews = item.metrics.reduce((sum, metric) => sum + metric.views, 0);
                  return <button key={item.id} className={`content-card ${selectedId === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}>
                    <div className="content-card-top"><span className="card-badge-row"><span className="status-badge">{item.status}</span><span className={`origin-badge ${item.origin === "历史归档" ? "archive" : ""}`}>{item.origin}</span><span className="recording-badge">{item.recordingMode}</span></span><span className="date">{item.publishedAt ? `发布于 ${item.publishedAt}` : `更新于 ${item.updatedAt}`}</span></div>
                    <h2>{item.title}</h2><p className="subtitle">{item.subtitle}</p>
                    <p className="viewpoint">{item.viewpoint || "核心观点待补充"}</p>
                    <div className="content-card-bottom"><span>{item.platforms.join(" · ")}{itemViews ? ` · ${formatNumber(itemViews)} 播放` : ""}</span><strong className="card-status-sync"><i className={`status-dot status-${statuses.indexOf(item.status)}`} />{item.status}</strong></div>
                  </button>;
                })}
              </div>
              {selected && <ContentDetail
                item={selected}
                activeRun={activeRun?.contentId === selected.id ? activeRun : null}
                onStatus={(status) => changeStatus(selected.id, status)}
                onRecordingMode={(mode) => changeContentRecordingMode(selected.id, mode)}
                onScript={(script) => updateContentScript(selected.id, script)}
                onConfirm={() => confirmContentScript(selected.id)}
                onGenerate={() => generateForItem(selected)}
                onCancel={() => void stopActiveRun()}
                onApplyVersion={(runId) => applyContentVersion(selected.id, runId)}
                onHtmlStyle={(style) => updateHtmlStyle(selected.id, style)}
                onCoverStyle={(style) => updateCoverStyle(selected.id, style)}
                onGenerateVisual={(kind) => void startVisualGeneration(selected, kind)}
                onAcceptVisual={(kind) => acceptVisualAsset(selected.id, kind)}
                onContinueVisual={(kind, instruction) => void continueProductionRun(selected, kind, instruction)}
                onMetric={(platform, field, value) => updateMetric(selected.id, platform, field, value)}
                onMetadata={(patch) => updateContentMetadata(selected.id, patch)}
                onDelete={() => deleteContent(selected.id)}
                onClose={() => setSelectedId(null)}
              />}
            </div>
          </section>
        )}

        {view === "cases" && (
          <section className="cases-layout">
            <div className="case-grid">
              {!db.cases.length && <div className="empty-state"><strong>还没有案例素材</strong><p>在右侧先记录一段真实经历，后续选题可以直接引用。</p></div>}
              {db.cases.map((item, index) => <article className="case-card" key={item.id}>
                <div className="case-index">{String(index + 1).padStart(2, "0")}</div><button className="case-delete-button" onClick={() => deleteCase(item.id)} aria-label={`删除案例 ${item.title}`}>删除</button><span className="case-industry">{item.industry}</span><h2>{item.title}</h2>
                <dl><div><dt>当时的问题</dt><dd>{item.background}</dd></div><div><dt>我的动作</dt><dd>{item.action}</dd></div><div><dt>留下的价值</dt><dd>{item.result}</dd></div></dl>
                <div className="tag-row">{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
              </article>)}
            </div>
            <aside className="add-case">
              <span className="eyebrow">ADD EXPERIENCE</span><h2>补一段真实经历</h2><p>先记录骨架，细节可以在做选题时继续补。</p>
              <label>案例名称<input value={caseDraft.title} onChange={(e) => setCaseDraft({ ...caseDraft, title: e.target.value })} placeholder="一句话说明这是什么经历" /></label>
              <label>行业 / 项目<input value={caseDraft.industry} onChange={(e) => setCaseDraft({ ...caseDraft, industry: e.target.value })} placeholder="例如：企业服务 / AI 知识库" /></label>
              <label>当时的问题<textarea value={caseDraft.background} onChange={(e) => setCaseDraft({ ...caseDraft, background: e.target.value })} /></label>
              <label>最后的结果<textarea value={caseDraft.result} onChange={(e) => setCaseDraft({ ...caseDraft, result: e.target.value })} /></label>
              <button className="primary-button" onClick={addCase}>加入案例库</button>
            </aside>
          </section>
        )}

        {view === "review" && (
          <section className="page-grid">
            <div className="metric-card span-3"><span className="card-label">总播放</span><strong>{formatNumber(totals.views)}</strong><p>所有已录入平台</p></div>
            <div className="metric-card span-3"><span className="card-label">互动率</span><strong>{totals.views ? ((totals.interactions / totals.views) * 100).toFixed(1) : 0}%</strong><p>赞藏评转 / 播放</p></div>
            <div className="metric-card span-3"><span className="card-label">收藏率</span><strong>{totals.views ? ((totals.saves / totals.views) * 100).toFixed(1) : 0}%</strong><p>专业价值信号</p></div>
            <div className="metric-card span-3 accent-card"><span className="card-label">关注转化</span><strong>{totals.views ? ((totals.follows / totals.views) * 100).toFixed(2) : 0}%</strong><p>账号增长信号</p></div>
            <div className="panel span-7">
              <div className="panel-heading"><div><span className="eyebrow">PLATFORM MIX</span><h2>平台播放对比</h2></div></div>
              <PlatformBars contents={db.contents} />
            </div>
            <div className="panel span-5 insight-panel">
              <span className="eyebrow">WHAT TO LEARN</span><h2>这组数据怎么用</h2>
              <div className="insight"><strong>收藏比点赞更重要</strong><p>你的目标是专业认可与后续课程转化。收藏高，说明内容被当成“以后还要回来看的方法”。</p></div>
              <div className="insight"><strong>先找平台差异，再改内容</strong><p>同一内容在不同平台表现不同，不一定是观点有问题，可能是标题、时长和封面没有适配。</p></div>
              <div className="insight"><strong>每条只改一个变量</strong><p>下一期只调整开头、结构或封面中的一个，否则很难知道到底什么有效。</p></div>
            </div>
            <div className="panel span-12">
              <div className="panel-heading"><div><span className="eyebrow">FORMAT LEARNING</span><h2>录制方式表现对比</h2></div><span className="muted">至少积累 6～10 条后再做稳定判断</span></div>
              <RecordingModeComparison contents={db.contents} />
            </div>
            <div className="panel span-12">
              <div className="panel-heading"><div><span className="eyebrow">CONTENT RESULT</span><h2>逐条内容表现</h2></div><span className="muted">在内容详情中录入数据</span></div>
              <div className="data-table"><div className="data-head"><span>内容</span><span>播放</span><span>收藏</span><span>新增关注</span><span>状态</span></div>{db.contents.map((item) => {
                const sum = item.metrics.reduce((acc, metric) => ({ views: acc.views + metric.views, saves: acc.saves + metric.saves, follows: acc.follows + metric.follows }), { views: 0, saves: 0, follows: 0 });
                return <button className="data-row" key={item.id} onClick={() => { setSelectedId(item.id); setView("library"); }}><strong>{item.title}<small className="table-mode">{item.recordingMode}</small></strong><span>{formatNumber(sum.views)}</span><span>{formatNumber(sum.saves)}</span><span>{formatNumber(sum.follows)}</span><span className="status-badge">{item.status}</span></button>;
              })}</div>
            </div>
          </section>
        )}

        {view === "tasks" && <TaskCenter runs={bridgeRuns} activeRun={activeRun} contents={db.contents} onRefresh={() => void refreshBridgeRuns()} onStop={() => void stopActiveRun()} onRetry={(runId) => void retryTask(runId)} onOpenContent={(contentId) => { const item = db.contents.find((content) => content.id === contentId); if (item) { setSelectedId(contentId); setView("library"); } else { setView("create"); } }} />}

        {view === "settings" && (
          <section className="settings-grid">
            <div className="panel profile-form">
              <div className="panel-heading"><div><span className="eyebrow">VOICE & POSITIONING</span><h2>账号上下文</h2></div></div>
              <p className="section-intro">这些内容会被带进 Codex 任务指令。写清楚之后，不需要每次重新解释你是谁。</p>
              <div className="fields two-col">
                <label>称呼<input value={db.settings.name} onChange={(e) => setDb({ ...db, settings: { ...db.settings, name: e.target.value } })} /></label>
                <label>当前身份<input value={db.settings.role} onChange={(e) => setDb({ ...db, settings: { ...db.settings, role: e.target.value } })} /></label>
                <label className="full">个人经历<textarea value={db.settings.experience} onChange={(e) => setDb({ ...db, settings: { ...db.settings, experience: e.target.value } })} /></label>
                <label className="full">目标人群<textarea value={db.settings.audience} onChange={(e) => setDb({ ...db, settings: { ...db.settings, audience: e.target.value } })} /></label>
                <label className="full">表达风格<textarea value={db.settings.style} onChange={(e) => setDb({ ...db, settings: { ...db.settings, style: e.target.value } })} /></label>
                <label className="full">内容与商业目标<textarea value={db.settings.goal} onChange={(e) => setDb({ ...db, settings: { ...db.settings, goal: e.target.value } })} /></label>
              </div>
              <div className="autosave"><span className="live-dot" /> 修改后自动保存在本地</div>
            </div>
            <div className="settings-side">
              <CodexConnectionPanel bridgeState={bridgeState} bridgeInfo={bridgeInfo} report={doctorReport} loading={doctorLoading} onCheck={() => void checkCodexConnection()} />
              <div className="panel data-tools">
                <span className="eyebrow">LOCAL DATA</span><h2>备份与迁移</h2><p>当前没有云同步。建议每次完成一期内容后导出一份 JSON 备份。</p>
                <button className="primary-button" onClick={exportData}>导出全部数据</button>
                <button className="secondary-button" onClick={() => importRef.current?.click()}>导入备份文件</button>
                <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={importData} />
                <div className="divider" />
                <button className="danger-button" onClick={clearAllContent}>清空全部内容与案例</button>
                <small>只清除内容、案例和对应运营数据；账号定位、表达风格与 Codex 连接配置不会被修改。此操作无法恢复，请先导出备份。</small>
              </div>
            </div>
          </section>
        )}
      </main>

      {researchOpen && <TopicResearchModal topic={scoutTopic} run={activeRun?.taskType === "research" ? activeRun : null} loading={researchLoading} error={researchError} result={researchResult} onClose={() => setResearchOpen(false)} onStop={() => void stopActiveRun()} onApply={(angle) => { setResearchOpen(false); applyAngle(angle); }} />}
      {historyOpen && <HistoryArchiveModal form={historyForm} onChange={setHistoryForm} onTogglePlatform={toggleHistoryPlatform} onMetric={updateHistoryMetric} onSave={addHistoricalContent} onClose={() => setHistoryOpen(false)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

function useRunElapsedSeconds(run: BridgeRun | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!run || (run.status !== "queued" && run.status !== "running")) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [run]);
  if (!run || (run.status !== "queued" && run.status !== "running")) return 0;
  const startedAt = new Date(run.startedAt || run.createdAt).getTime();
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

function elapsedLabel(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

const taskTypeCopy: Record<BridgeRun["taskType"], string> = {
  research: "联网选题调研",
  angles: "三个选题角度",
  content: "内容稿",
  html: "HTML 录屏页",
  cover: "三尺寸封面",
  publishing: "平台发布包",
};

const runStatusCopy: Record<BridgeRunStatus, string> = {
  queued: "排队中",
  running: "生成中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  timeout: "已超时",
  interrupted: "被中断",
};

const doctorCheckCopy: Record<string, string> = {
  node: "Node.js 环境",
  codex: "Codex CLI",
  login: "Codex 登录",
  skill: "工作站 Skill",
  workspace: "任务工作区",
  "image-generation": "图片生成能力",
  renderer: "本地渲染能力",
  "web-port": "网页端口",
  "bridge-port": "Bridge 服务",
};

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function CodexConnectionPanel({ bridgeState, bridgeInfo, report, loading, onCheck }: {
  bridgeState: "checking" | "connected" | "offline";
  bridgeInfo: { version: string; activeRuns: number } | null;
  report: DoctorReport | null;
  loading: boolean;
  onCheck: () => void;
}) {
  const summary = bridgeState === "offline" ? "未连接" : report?.overall === "fail" ? "需要修复" : report?.overall === "warn" ? "可用，有提醒" : report?.overall === "pass" ? "连接正常" : "等待检测";
  return <section className="panel codex-connection-panel">
    <div className="connection-head"><div><span className="eyebrow">LOCAL CODEX</span><h2>Codex 连接中心</h2></div><strong className={`connection-summary summary-${report?.overall || bridgeState}`}>{summary}</strong></div>
    <p>工作站复用本机 Codex CLI 的登录状态，不读取或展示认证文件。</p>
    <div className="connection-meta"><span>Bridge {bridgeInfo?.version || "—"}</span><span>{bridgeInfo?.activeRuns || 0} 个运行中任务</span></div>
    <button className="primary-button" onClick={onCheck} disabled={loading}>{loading ? "正在检查…" : "重新检测连接"}</button>
    {report && <div className="doctor-list">{report.checks.map((check) => <article key={check.id} className={`doctor-${check.status}`}><i>{check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "×"}</i><div><strong>{doctorCheckCopy[check.id] || check.id}</strong><small>{check.message}</small>{check.fix && <p>{check.fix}</p>}</div></article>)}</div>}
    {bridgeState === "offline" && <div className="connection-offline"><strong>先启动本机 Bridge</strong><code>npm run start:bridge</code></div>}
  </section>;
}

function TaskCenter({ runs, activeRun, contents, onRefresh, onStop, onRetry, onOpenContent }: {
  runs: BridgeRun[];
  activeRun: BridgeRun | null;
  contents: ContentItem[];
  onRefresh: () => void;
  onStop: () => void;
  onRetry: (runId: string) => void;
  onOpenContent: (contentId: string) => void;
}) {
  const runningCount = runs.filter((run) => run.status === "queued" || run.status === "running").length;
  const failedCount = runs.filter((run) => run.status === "failed" || run.status === "timeout" || run.status === "interrupted").length;
  return <section className="task-center">
    <div className="task-summary-grid"><article><span>全部任务</span><strong>{runs.length}</strong><small>Bridge 本地记录</small></article><article><span>正在执行</span><strong>{runningCount}</strong><small>同一时间最多 1 个</small></article><article><span>需要处理</span><strong>{failedCount}</strong><small>失败、超时或中断</small></article><button className="secondary-button" onClick={onRefresh}>刷新任务</button></div>
    <div className="panel task-list-panel">
      <div className="panel-heading"><div><span className="eyebrow">RUN HISTORY</span><h2>Codex 任务记录</h2></div><span className="muted">按创建时间倒序</span></div>
      <div className="task-run-list">{runs.length ? runs.map((run) => {
        const content = contents.find((item) => item.id === run.contentId);
        const isRunning = run.status === "queued" || run.status === "running";
        const canRetry = !isRunning && !activeRun;
        return <article key={run.runId} className={isRunning ? "active" : ""}>
          <div className="task-run-main"><span className={`run-state run-${run.status}`}>{runStatusCopy[run.status]}</span><div><strong>{taskTypeCopy[run.taskType]}</strong><h3>{content?.title || (run.taskType === "research" || run.taskType === "angles" ? "选题探索任务" : run.contentId)}</h3><small>{new Date(run.createdAt).toLocaleString("zh-CN")} · {run.runId.slice(0, 16)}…</small></div></div>
          {run.error && <p className="task-run-error">{run.error.message}</p>}
          <div className="task-run-actions">{content && <button className="text-button" onClick={() => onOpenContent(run.contentId)}>打开内容</button>}{isRunning && activeRun?.runId === run.runId ? <button className="secondary-button" onClick={onStop}>停止任务</button> : <button className="secondary-button" disabled={!canRetry} onClick={() => onRetry(run.runId)}>按原输入重试</button>}</div>
        </article>;
      }) : <div className="empty-state compact"><strong>还没有 Codex 任务</strong><p>生成选题角度、内容稿或视觉资产后，任务会统一出现在这里。</p></div>}</div>
    </div>
  </section>;
}

function TopicResearchModal({ topic, run, loading, error, result, onClose, onStop, onApply }: {
  topic: string;
  run: BridgeRun | null;
  loading: boolean;
  error: string;
  result: TopicResearchResult | null;
  onClose: () => void;
  onStop: () => void;
  onApply: (angle: TopicAngle) => void;
}) {
  const elapsed = useRunElapsedSeconds(run);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="task-modal research-result-modal" role="dialog" aria-modal="true" aria-labelledby="research-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">LIVE TOPIC RESEARCH</span><h2 id="research-title">Codex 联网选题调研</h2><p>{topic}</p></div><button className="icon-button" onClick={onClose} aria-label="关闭">×</button></div>
    {loading && <div className="research-running"><div className="run-activity" role="status"><div className="run-activity-copy"><span className="run-spinner" /><div><strong>{run?.status === "queued" ? "任务已提交，等待本机 Codex 接收" : "正在搜索公开样本并核验来源"}</strong><small>已运行 {elapsedLabel(elapsed)}。不可访问的平台会明确标记，不会补写虚构数据。</small></div></div><button className="secondary-button" onClick={onStop}>停止</button><div className="run-progress"><i /></div></div></div>}
    {error && <div className="angle-error"><strong>调研未完成</strong><p>{error}</p></div>}
    {result && <div className="research-report"><div className="research-summary"><span>{result.generationMeta.researchUsed ? "已使用联网搜索" : "未使用联网搜索"}</span><p>{result.summary}</p></div><div className="research-columns"><section><h3>常见角度</h3><ul>{result.commonAngles.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>内容空白</h3><ul>{result.contentGaps.map((item) => <li key={item}>{item}</li>)}</ul></section></div><div className="research-platforms">{result.platformFindings.map((finding) => <section key={finding.platform}><div><h3>{finding.platform}</h3><span>{finding.accessibility}</span></div>{finding.samples.length ? <ul>{finding.samples.map((sample, index) => { const href = safeExternalUrl(sample.url); return <li key={`${sample.title}-${index}`}><strong>{sample.title}</strong><small>{sample.author} · {sample.publishedAt || "时间不可见"} · {sample.visibleMetrics || "互动数据不可见"}</small><p>{sample.angle}</p>{href && <a href={href} target="_blank" rel="noreferrer">查看来源 ↗</a>}</li>; })}</ul> : <p>{finding.limitations || "本次未找到可核验公开样本。"}</p>}</section>)}</div><div className="research-recommendations"><h3>建议切入角度</h3>{result.recommendedAngles.map((angle, index) => <article key={`${angle.type}-${angle.title}`} className={index === result.recommendedAngleIndex ? "recommended" : ""}><span>{index === result.recommendedAngleIndex ? "推荐" : angle.type}</span><h4>{angle.title}</h4><p>{angle.viewpoint}</p><small>需要证据：{angle.evidenceNeeded}</small><button className="primary-button" onClick={() => onApply(angle)}>用这个角度写</button></article>)}</div>{result.manualFollowups.length > 0 && <div className="research-followups"><strong>还需要人工补充</strong><ul>{result.manualFollowups.map((item) => <li key={item}>{item}</li>)}</ul></div>}</div>}
    {!loading && <div className="modal-actions"><button className="secondary-button" onClick={onClose}>关闭</button></div>}
  </section></div>;
}

function TopicAngleGenerationStatus({ run, onCancel }: { run: BridgeRun | null; onCancel: () => void }) {
  const elapsed = useRunElapsedSeconds(run);
  return <div className="angle-results">
    <div className="angle-title"><strong>本机 Codex 正在生成 3 个切入角度</strong><span>{run?.status === "queued" ? "任务已提交，等待执行" : `已运行 ${elapsedLabel(elapsed)}`}</span></div>
    <div className="run-activity" role="status" aria-live="polite"><div className="run-activity-copy"><span className="run-spinner" /><div><strong>{run?.status === "queued" ? "等待本机 Codex 接收任务" : "正在结合账号定位、议题与案例库进行判断"}</strong><small>完成后会自动显示三张角度卡片；生成期间可以停止任务。</small></div></div><button className="secondary-button" onClick={onCancel}>停止</button><div className="run-progress"><i /></div></div>
    <div className="angle-grid loading">{[1, 2, 3].map((item) => <article key={item}><i /><i /><i /><i /></article>)}</div>
  </div>;
}

function ContentGenerationPanel({ item, activeRun, onGenerate, onCancel, onApplyVersion }: {
  item: ContentItem;
  activeRun: BridgeRun | null;
  onGenerate: () => void;
  onCancel: () => void;
  onApplyVersion: (runId: string) => void;
}) {
  const isRunning = activeRun?.taskType === "content" && (activeRun.status === "queued" || activeRun.status === "running");
  const elapsed = useRunElapsedSeconds(isRunning ? activeRun : null);
  const statusText = isRunning ? activeRun?.status === "queued" ? "任务排队中" : "Codex 正在生成" : item.latestRunStatus === "completed" ? "最近一次生成完成" : item.latestRunStatus === "idle" ? "尚未生成" : `最近任务：${item.latestRunStatus}`;
  return <div className={`generation-panel ${isRunning ? "running" : ""}`}>
    <div className="generation-status"><span><i />{statusText}</span><small>{isRunning ? `已进行 ${elapsedLabel(elapsed)}` : `已保留 ${item.contentVersions.length} 个生成版本`}</small></div>
    {isRunning && <div className="run-activity" role="status" aria-live="polite"><div className="run-activity-copy"><span className="run-spinner" /><div><strong>{activeRun?.status === "queued" ? "已提交，等待本机 Codex 接收任务" : "正在组织内容结构并生成完整稿件"}</strong><small>任务仍在持续运行，完成后会自动回填；可以停留在本页或继续浏览其他内容。</small></div></div><div className="run-progress"><i /></div></div>}
    <div className="generation-actions"><button className="primary-button" onClick={onGenerate} disabled={Boolean(isRunning)}>{isRunning ? "正在生成…" : item.contentVersions.length ? "重新生成一个版本" : "使用 Codex 生成内容"}</button>{isRunning && <button className="secondary-button" onClick={onCancel}>停止任务</button>}</div>
    {item.contentVersions.length > 0 && <div className="version-list">{item.contentVersions.slice(0, 4).map((version) => <article key={version.runId} className={version.state === "已采用" ? "accepted" : ""}><div><strong>版本 {version.version}</strong><small>{new Date(version.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} · {version.state}</small></div><p>{version.subtitle || "副标题待完善"}</p>{version.state !== "已采用" && <button onClick={() => onApplyVersion(version.runId)}>采用这个版本</button>}</article>)}</div>}
  </div>;
}

function ArtifactPreview({ runId, manifest }: { runId: string; manifest: ArtifactManifest }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    void Promise.all(manifest.artifacts.map(async (artifact) => {
      const blob = await getArtifactBlob(runId, artifact.id);
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      const previewText = artifact.mimeType === "text/markdown" ? await blob.text() : "";
      return [artifact.id, url, previewText] as const;
    })).then((entries) => {
      if (!disposed) {
        setUrls(Object.fromEntries(entries.map(([id, url]) => [id, url])));
        setTexts(Object.fromEntries(entries.filter(([, , previewText]) => previewText).map(([id, , previewText]) => [id, previewText])));
      }
    }).catch((reason) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : "产物预览加载失败");
    });
    return () => {
      disposed = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [manifest, runId]);

  if (error) return <div className="artifact-error">{error}</div>;
  if (manifest.taskType === "html") {
    const artifact = manifest.artifacts.find((item) => item.type === "recording-html");
    return <div className="html-artifact-preview">{artifact && urls[artifact.id] ? <iframe src={urls[artifact.id]} title="HTML 录屏页预览" sandbox="allow-scripts" /> : <span>正在加载 HTML 预览…</span>}</div>;
  }
  if (manifest.taskType === "publishing") {
    const artifact = manifest.artifacts.find((item) => item.type === "publishing-package");
    return <div className="publishing-artifact-preview">{artifact && texts[artifact.id] ? <><pre>{texts[artifact.id]}</pre><a className="primary-button" href={urls[artifact.id]} download="publishing-package.md">下载发布包 Markdown</a></> : <span>正在加载发布包预览…</span>}</div>;
  }
  return <div className="cover-artifact-grid">{manifest.artifacts.map((artifact) => <figure key={artifact.id} className={`cover-${artifact.type}`}><div>{urls[artifact.id] ? <Image src={urls[artifact.id]} alt={`${artifact.type} 封面预览`} width={artifact.width || 900} height={artifact.height || 900} unoptimized /> : <span>正在加载…</span>}</div><figcaption>{artifact.type.replace("cover-", "")} · {artifact.width}×{artifact.height}</figcaption></figure>)}</div>;
}

function BundleExportPanel({ item }: { item: ContentItem }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const included = [
    item.script.trim() ? "内容稿" : "",
    item.htmlState === "已生成" && item.htmlManifest && item.htmlRunId ? "HTML" : "",
    item.coverState === "已生成" && item.coverManifest && item.coverRunId ? "三张封面" : "",
    item.publishingState === "已生成" && item.publishingManifest && item.publishingRunId ? publishingPackageLabel(item.platforms) : "",
  ].filter(Boolean);

  async function downloadBundle() {
    setExporting(true);
    setError("");
    try {
      const blob = await getContentBundle({
        contentId: item.id,
        title: item.title,
        subtitle: item.subtitle,
        platforms: item.platforms,
        script: item.script,
        runIds: {
          html: item.htmlState === "已生成" && item.htmlManifest ? item.htmlRunId : "",
          cover: item.coverState === "已生成" && item.coverManifest ? item.coverRunId : "",
          publishing: item.publishingState === "已生成" && item.publishingManifest ? item.publishingRunId : "",
        },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTitle = item.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60) || "本期内容";
      link.href = url;
      link.download = `${safeTitle}-完整交付包.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "完整包导出失败");
    } finally {
      setExporting(false);
    }
  }

  return <section className="bundle-export-panel">
    <div><span>COMPLETE PACKAGE</span><strong>导出本期完整交付包</strong><small>当前将包含：{included.join("、") || "暂无可导出内容"}</small></div>
    <button className="primary-button" onClick={() => void downloadBundle()} disabled={exporting || included.length === 0}>{exporting ? "正在打包…" : "下载 ZIP"}</button>
    {error && <p>{error}</p>}
  </section>;
}

function VisualGenerationPanel({ item, taskType, activeRun, onGenerate, onCancel, onAccept, onContinue, disabled = false, disabledReason = "" }: {
  item: ContentItem;
  taskType: "html" | "cover" | "publishing";
  activeRun: BridgeRun | null;
  onGenerate: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onContinue: (instruction: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const isRunning = activeRun?.taskType === taskType && (activeRun.status === "queued" || activeRun.status === "running");
  const elapsed = useRunElapsedSeconds(isRunning ? activeRun : null);
  const pendingManifest = taskType === "html" ? item.pendingHtmlManifest : taskType === "cover" ? item.pendingCoverManifest : item.pendingPublishingManifest;
  const pendingRunId = taskType === "html" ? item.pendingHtmlRunId : taskType === "cover" ? item.pendingCoverRunId : item.pendingPublishingRunId;
  const acceptedManifest = taskType === "html" ? item.htmlManifest : taskType === "cover" ? item.coverManifest : item.publishingManifest;
  const acceptedRunId = taskType === "html" ? item.htmlRunId : taskType === "cover" ? item.coverRunId : item.publishingRunId;
  const shownManifest = pendingManifest || acceptedManifest;
  const shownRunId = pendingManifest ? pendingRunId : acceptedRunId;
  const packageLabel = publishingPackageLabel(item.platforms);
  const runningAction = taskType === "html" ? "正在生成录屏页面并检查文件" : taskType === "cover" ? "正在制作三种尺寸并检查画面" : `正在整理${selectedPlatformNames(item.platforms)}的发布文案`;
  return <div className={`visual-generation ${isRunning ? "running" : ""}`}>
    <div className="visual-generation-head"><div><strong>{isRunning ? "Codex 正在制作" : pendingManifest ? "新产物等待验收" : acceptedManifest ? "当前已接受产物" : "尚未生成产物"}</strong><small>{disabled ? `尚未解锁：${disabledReason}` : taskType === "cover" ? shownManifest ? shownManifest.generationMode === "codex-template-render" ? "本次使用模板降级生成" : "本次使用图片素材＋精确排版" : "三个尺寸独立生成，不机械裁切" : taskType === "html" ? "单文件 HTML，可直接录屏" : `生成可预览、可下载的${packageLabel} Markdown`}</small></div><div><button className={`primary-button ${disabled && !isRunning ? "locked-action" : ""}`} title={disabled && !isRunning ? disabledReason : undefined} onClick={onGenerate} disabled={Boolean(isRunning)}>{isRunning ? `生成中 · ${elapsedLabel(elapsed)}` : shownManifest ? "重新生成" : disabled ? "查看解锁条件" : "直接生成"}</button>{isRunning && <button className="secondary-button" onClick={onCancel}>停止</button>}</div></div>
    {isRunning && <div className="run-activity" role="status" aria-live="polite"><div className="run-activity-copy"><span className="run-spinner" /><div><strong>{activeRun?.status === "queued" ? "已提交，等待本机 Codex 接收任务" : runningAction}</strong><small>任务正在本机持续执行，完成后这里会自动出现预览和验收按钮。</small></div></div><div className="run-progress"><i /></div></div>}
    {shownManifest && shownRunId && <ArtifactPreview runId={shownRunId} manifest={shownManifest} />}
    {shownManifest && shownRunId && !isRunning && <div className="artifact-revision"><input value={revisionInstruction} onChange={(event) => setRevisionInstruction(event.target.value)} placeholder={taskType === "html" ? "例如：第二屏减少文字，流程图放大" : taskType === "cover" ? "例如：主标题改成 8 个字，黄色更醒目" : "例如：小红书标题更口语，补充 5 个标签"} /><button className="secondary-button" disabled={!revisionInstruction.trim()} onClick={() => { onContinue(revisionInstruction); setRevisionInstruction(""); }}>继续修改</button></div>}
    {pendingManifest && <div className="artifact-accept"><span>先检查内容、文字和构图，再同步为完成状态。</span><button className="primary-button" onClick={onAccept}>接受这版产物</button></div>}
  </div>;
}

function InlineCreationWorkflow({ item, activeRun, onScript, onConfirm, onGenerate, onCancel, onApplyVersion, onHtmlStyle, onCoverStyle, onGenerateVisual, onAcceptVisual, onContinueVisual }: {
  item: ContentItem;
  activeRun: BridgeRun | null;
  onScript: (script: string) => void;
  onConfirm: () => void;
  onGenerate: () => void;
  onCancel: () => void;
  onApplyVersion: (runId: string) => void;
  onHtmlStyle: (style: HtmlStyle) => void;
  onCoverStyle: (style: CoverStyle) => void;
  onGenerateVisual: (kind: "html" | "cover" | "publishing") => void;
  onAcceptVisual: (kind: "html" | "cover" | "publishing") => void;
  onContinueVisual: (kind: "html" | "cover" | "publishing", instruction: string) => void;
}) {
  const confirmed = item.draftState === "已确认";
  const missingAssets = missingPublishingAssets(item);
  const publishingReady = missingAssets.length === 0;
  const deliveryDone = item.publishingState === "已生成" && Boolean(item.publishingManifest);
  return <section className="inline-workflow" id="current-production">
    <div className="inline-workflow-head"><div><span className="eyebrow">CURRENT PRODUCTION</span><h2>继续完成这期内容</h2><p>选题已自动进入内容库，但后续操作都可以在当前页面完成。</p></div><strong>{item.title}</strong></div>
    <ol className="inline-stage-strip">
      <li className={item.script.trim() ? "done" : "current"}><span>1</span>内容回填</li>
      <li className={confirmed ? "done" : item.script.trim() ? "current" : ""}><span>2</span>编辑确认</li>
      <li className={confirmed ? "current" : "locked"}><span>3</span>视觉制作</li>
      <li className={deliveryDone ? "done" : publishingReady ? "current" : "locked"}><span>4</span>发布包交付</li>
    </ol>

    <div className="inline-editor-section">
      <div className="inline-section-head"><div><span>04 · 内容稿</span><h3>Codex 生成后自动回填，可继续编辑</h3></div><strong className={`light-state light-${item.draftState}`}>{item.draftState}</strong></div>
      <ContentGenerationPanel item={item} activeRun={activeRun} onGenerate={onGenerate} onCancel={onCancel} onApplyVersion={onApplyVersion} />
      <textarea className="inline-content-editor" value={item.script} onChange={(e) => onScript(e.target.value)} placeholder="生成完成后内容会自动出现在这里；你也可以直接开始手写和修改……" />
      <div className="inline-actions"><span>{item.script.trim().length} 字符 · 自动同步到内容库</span><div><button className="primary-button" onClick={onConfirm} disabled={!item.script.trim() || confirmed}>{confirmed ? "内容已确认" : "确认内容，继续制作 →"}</button></div></div>
    </div>

    {!confirmed && <div className="inline-gate"><strong>视觉制作尚未解锁</strong><p>先完成上面的内容回填和确认。这样修改观点或口播时，不需要反复重做 HTML 和封面。</p></div>}

    {confirmed && <div className="inline-assets">
      <section>
        <div className="inline-section-head"><div><span>05 · HTML 录屏页</span><h3>选择页面风格后单独生成</h3></div><strong className={`light-state light-${item.htmlState}`}>{item.htmlState}</strong></div>
        <div className="inline-style-grid">{(Object.entries(htmlStyles) as [HtmlStyle, { mark: string; description: string }][]).map(([style, copy]) => <button className={item.htmlStyle === style ? "selected" : ""} key={style} onClick={() => onHtmlStyle(style)}><i>{copy.mark}</i><strong>{style}</strong><small>{copy.description}</small></button>)}</div>
        <VisualGenerationPanel item={item} taskType="html" activeRun={activeRun} onGenerate={() => onGenerateVisual("html")} onCancel={onCancel} onAccept={() => onAcceptVisual("html")} onContinue={(instruction) => onContinueVisual("html", instruction)} />
      </section>
      <section>
        <div className="inline-section-head"><div><span>06 · 三尺寸封面</span><h3>选择封面风格后单独生成</h3></div><strong className={`light-state light-${item.coverState}`}>{item.coverState}</strong></div>
        <div className="inline-style-grid">{(Object.entries(coverStyles) as [CoverStyle, { mark: string; description: string }][]).map(([style, copy]) => <button className={item.coverStyle === style ? "selected" : ""} key={style} onClick={() => onCoverStyle(style)}><i>{copy.mark}</i><strong>{style}</strong><small>{copy.description}</small></button>)}</div>
        <VisualGenerationPanel item={item} taskType="cover" activeRun={activeRun} onGenerate={() => onGenerateVisual("cover")} onCancel={onCancel} onAccept={() => onAcceptVisual("cover")} onContinue={(instruction) => onContinueVisual("cover", instruction)} />
      </section>
      <section>
        <div className="inline-section-head"><div><span>07 · {publishingPackageLabel(item.platforms)}</span><h3>为 {selectedPlatformNames(item.platforms)} 生成发布文案</h3></div><strong className={`light-state light-${item.publishingState}`}>{item.publishingState}</strong></div>
        <VisualGenerationPanel item={item} taskType="publishing" activeRun={activeRun} onGenerate={() => onGenerateVisual("publishing")} onCancel={onCancel} onAccept={() => onAcceptVisual("publishing")} onContinue={(instruction) => onContinueVisual("publishing", instruction)} disabled={!publishingReady} disabledReason={publishingDisabledReason(item)} />
      </section>
    </div>}
  </section>;
}

function ContentDetail({ item, activeRun, onStatus, onRecordingMode, onScript, onConfirm, onGenerate, onCancel, onApplyVersion, onHtmlStyle, onCoverStyle, onGenerateVisual, onAcceptVisual, onContinueVisual, onMetric, onMetadata, onDelete, onClose }: {
  item: ContentItem;
  activeRun: BridgeRun | null;
  onStatus: (status: ContentStatus) => void;
  onRecordingMode: (mode: Exclude<RecordingMode, "未设置">) => void;
  onScript: (script: string) => void;
  onConfirm: () => void;
  onGenerate: () => void;
  onCancel: () => void;
  onApplyVersion: (runId: string) => void;
  onHtmlStyle: (style: HtmlStyle) => void;
  onCoverStyle: (style: CoverStyle) => void;
  onGenerateVisual: (kind: "html" | "cover" | "publishing") => void;
  onAcceptVisual: (kind: "html" | "cover" | "publishing") => void;
  onContinueVisual: (kind: "html" | "cover" | "publishing", instruction: string) => void;
  onMetric: (platform: Platform, field: keyof Omit<Metric, "platform">, value: number) => void;
  onMetadata: (patch: Partial<Pick<ContentItem, "title" | "subtitle" | "publishedAt" | "publishLinks" | "archiveNotes" | "viewpoint">>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"brief" | "script" | "production" | "deliverables" | "data">("brief");
  const contentConfirmed = item.draftState === "已确认";
  const publishingReady = missingPublishingAssets(item).length === 0;
  return <aside className="detail-panel">
    <div className="detail-heading"><span className="eyebrow">CONTENT DETAIL</span><div className="detail-heading-actions"><button className="detail-delete-button" onClick={onDelete}>删除内容</button><button className="icon-button" onClick={onClose} aria-label="关闭详情">×</button></div></div>
    <div className="detail-origin"><span className={`origin-badge ${item.origin === "历史归档" ? "archive" : ""}`}>{item.origin}</span>{item.publishedAt && <small>发布于 {item.publishedAt}</small>}</div>
    <h2>{item.title}</h2><p className="detail-subtitle">{item.subtitle}</p>
    <label className="status-select">当前状态<select value={item.status} onChange={(e) => onStatus(e.target.value as ContentStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
    <div className="asset-stage-strip"><span className={item.draftState === "已确认" ? "done" : "current"}>1 内容 {item.draftState}</span><i>→</i><span className={publishingReady ? "done" : contentConfirmed ? "current" : "locked"}>2 视觉制作</span><i>→</i><span className={item.publishingState === "已生成" && item.publishingManifest ? "done" : publishingReady ? "current" : "locked"}>3 发布包交付</span></div>
    <div className="tabs five"><button className={tab === "brief" ? "active" : ""} onClick={() => setTab("brief")}>选题</button><button className={tab === "script" ? "active" : ""} onClick={() => setTab("script")}>内容稿</button><button className={tab === "production" ? "active" : ""} onClick={() => setTab("production")}>视觉制作</button><button className={tab === "deliverables" ? "active" : ""} onClick={() => setTab("deliverables")}>交付物</button><button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>数据</button></div>
    {tab === "brief" && (item.origin === "历史归档" ? <div className="detail-body archive-maintenance">
      <p className="archive-help">这条内容不是通过工作站创建的。可在这里持续补全历史资料，平台表现请到“数据”页维护。</p>
      <label>标题<input value={item.title} onChange={(e) => onMetadata({ title: e.target.value })} /></label>
      <label>副标题<input value={item.subtitle} onChange={(e) => onMetadata({ subtitle: e.target.value })} /></label>
      <label>发布日期<input type="date" value={item.publishedAt} onChange={(e) => onMetadata({ publishedAt: e.target.value })} /></label>
      <label>核心观点<textarea value={item.viewpoint} onChange={(e) => onMetadata({ viewpoint: e.target.value })} placeholder="这条内容最重要的结论" /></label>
      {item.platforms.map((platform) => <label key={platform}>{platform} 发布链接<input type="url" value={item.publishLinks[platform] || ""} onChange={(e) => onMetadata({ publishLinks: { ...item.publishLinks, [platform]: e.target.value } })} placeholder="https://" /></label>)}
      <label>归档备注<textarea value={item.archiveNotes} onChange={(e) => onMetadata({ archiveNotes: e.target.value })} placeholder="选题背景、复盘判断、素材位置等" /></label>
    </div> : <div className="detail-body"><DetailBlock label="目标人群" text={item.audience} /><DetailBlock label="真实痛点" text={item.pain} /><DetailBlock label="核心观点" text={item.viewpoint} /><DetailBlock label="案例素材" text={item.cases} /></div>)}
    {tab === "script" && <div className="detail-body script-workspace">
      <div className="script-head"><div><span>内容状态</span><strong className={`draft-state state-${item.draftState}`}>{item.draftState}</strong></div><small>Codex 会自动回填，你也可以直接修改。任何修改都会让已确认内容回到“编辑中”。</small></div>
      <ContentGenerationPanel item={item} activeRun={activeRun} onGenerate={onGenerate} onCancel={onCancel} onApplyVersion={onApplyVersion} />
      <label className="content-editor-label">完整内容稿<textarea className="content-editor" value={item.script} onChange={(e) => onScript(e.target.value)} placeholder="Codex 生成完成后会自动回填；你可以继续删改和补充真实案例……" /></label>
      <div className="script-actions"><span>{item.script.trim().length} 字符 · 本地自动保存</span><div><button className="primary-button" onClick={onConfirm} disabled={!item.script.trim() || contentConfirmed}>{contentConfirmed ? "内容已确认" : "确认内容，进入视觉制作 →"}</button></div></div>
    </div>}
    {tab === "production" && <div className="detail-body">
      {!contentConfirmed && <div className="production-lock"><span>锁</span><div><strong>请先确认内容稿</strong><p>HTML 和封面会读取最终标题、结构与口播。内容未确认时生成，后续修改会造成重复返工。</p><button className="secondary-button" onClick={() => setTab("script")}>去编辑内容稿</button></div></div>}
      {contentConfirmed && <>
        <div className="production-mode-head"><span>{item.recordingMode === "未设置" ? "?" : recordingModeCopy[item.recordingMode].icon}</span><div><small>已确认内容 · 呈现方式</small><strong>{item.recordingMode}</strong></div></div>
        <label className="detail-mode-select">修改录制方式<select value={item.recordingMode} onChange={(e) => onRecordingMode(e.target.value as Exclude<RecordingMode, "未设置">)}><option value="未设置" disabled>请选择</option>{recordingModes.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
        <section className="asset-builder"><div className="asset-builder-head"><div><span>HTML 录屏页</span><h3>选择页面风格</h3></div><strong className={`asset-state asset-${item.htmlState}`}>{item.htmlState}</strong></div><div className="style-grid">{(Object.entries(htmlStyles) as [HtmlStyle, { mark: string; description: string }][]).map(([style, copy]) => <button className={item.htmlStyle === style ? "selected" : ""} key={style} onClick={() => onHtmlStyle(style)}><i>{copy.mark}</i><strong>{style}</strong><small>{copy.description}</small></button>)}</div><VisualGenerationPanel item={item} taskType="html" activeRun={activeRun} onGenerate={() => onGenerateVisual("html")} onCancel={onCancel} onAccept={() => onAcceptVisual("html")} onContinue={(instruction) => onContinueVisual("html", instruction)} /></section>
        <section className="asset-builder"><div className="asset-builder-head"><div><span>三尺寸封面</span><h3>选择封面风格</h3></div><strong className={`asset-state asset-${item.coverState}`}>{item.coverState}</strong></div><div className="style-grid">{(Object.entries(coverStyles) as [CoverStyle, { mark: string; description: string }][]).map(([style, copy]) => <button className={item.coverStyle === style ? "selected" : ""} key={style} onClick={() => onCoverStyle(style)}><i>{copy.mark}</i><strong>{style}</strong><small>{copy.description}</small></button>)}</div><VisualGenerationPanel item={item} taskType="cover" activeRun={activeRun} onGenerate={() => onGenerateVisual("cover")} onCancel={onCancel} onAccept={() => onAcceptVisual("cover")} onContinue={(instruction) => onContinueVisual("cover", instruction)} /></section>
        <section className="asset-builder"><div className="asset-builder-head"><div><span>{publishingPackageLabel(item.platforms)}</span><h3>为 {selectedPlatformNames(item.platforms)} 生成、检查并下载 Markdown</h3></div><strong className={`asset-state asset-${item.publishingState}`}>{item.publishingState}</strong></div><VisualGenerationPanel item={item} taskType="publishing" activeRun={activeRun} onGenerate={() => onGenerateVisual("publishing")} onCancel={onCancel} onAccept={() => onAcceptVisual("publishing")} onContinue={(instruction) => onContinueVisual("publishing", instruction)} disabled={!publishingReady} disabledReason={publishingDisabledReason(item)} /></section>
      </>}
    </div>}
    {tab === "deliverables" && <div className="detail-body"><div className="deliverable-status-grid"><article><span>内容稿</span><strong>{item.draftState}</strong><small>可查看、编辑并人工确认</small></article><article><span>HTML 页面</span><strong>{item.htmlState}</strong><small>{item.htmlStyle}</small></article><article><span>三尺寸封面</span><strong>{item.coverState}</strong><small>{item.coverStyle}</small></article><article><span>{publishingPackageLabel(item.platforms)}</span><strong>{item.publishingState}</strong><small>{selectedPlatformNames(item.platforms)} · 验收后可下载</small></article></div><BundleExportPanel item={item} />{item.publishingManifest && item.publishingRunId && <ArtifactPreview runId={item.publishingRunId} manifest={item.publishingManifest} />}<DetailBlock label="已确认内容摘要" text={item.script || "尚未回填内容稿。"} /></div>}
    {tab === "data" && <div className="metric-editor"><p>发布后录入各平台数据，工作台会自动汇总。</p>{item.metrics.map((metric) => <fieldset key={metric.platform}><legend>{metric.platform}</legend><div>{(["views", "likes", "saves", "comments", "shares", "follows"] as const).map((field) => <label key={field}>{({ views: "播放", likes: "点赞", saves: "收藏", comments: "评论", shares: "转发", follows: "关注" })[field]}<input type="number" min="0" value={metric[field]} onChange={(e) => onMetric(metric.platform, field, Math.max(0, Number(e.target.value)))} /></label>)}</div></fieldset>)}</div>}
  </aside>;
}

function HistoryArchiveModal({ form, onChange, onTogglePlatform, onMetric, onSave, onClose }: {
  form: HistoryForm;
  onChange: (form: HistoryForm) => void;
  onTogglePlatform: (platform: Platform) => void;
  onMetric: (platform: Platform, field: keyof Omit<Metric, "platform">, value: number) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="task-modal history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modal-heading"><div><span className="eyebrow">HISTORY ARCHIVE</span><h2 id="history-title">归档已有自媒体内容</h2><p>用于留存以前发布过、但不是从工作站创建的内容。保存后可继续维护原稿、链接和表现数据。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭">×</button></div>
    <div className="history-form">
      <label>内容标题<input autoFocus value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} placeholder="请输入已发布内容标题" /></label>
      <label>副标题 / 一句话说明<input value={form.subtitle} onChange={(e) => onChange({ ...form, subtitle: e.target.value })} placeholder="可选" /></label>
      <div className="history-two-col"><label>发布日期<input type="date" value={form.publishedAt} onChange={(e) => onChange({ ...form, publishedAt: e.target.value })} /></label><label>呈现方式<select value={form.recordingMode} onChange={(e) => onChange({ ...form, recordingMode: e.target.value as RecordingMode })}><option>未设置</option>{recordingModes.map((mode) => <option key={mode}>{mode}</option>)}</select></label></div>
      <fieldset><legend>已发布平台</legend><div className="history-platforms">{platforms.map((platform) => <label key={platform}><input type="checkbox" checked={form.platforms.includes(platform)} onChange={() => onTogglePlatform(platform)} /><span>{platform}</span></label>)}</div></fieldset>
      <label>核心观点 / 内容摘要<textarea value={form.viewpoint} onChange={(e) => onChange({ ...form, viewpoint: e.target.value })} placeholder="以后检索和复盘时，能快速判断这条讲了什么" /></label>
      <label>原稿或文案<textarea value={form.script} onChange={(e) => onChange({ ...form, script: e.target.value })} placeholder="可粘贴完整口播稿、图文正文或发布文案" /></label>
      <div className="history-link-grid">{form.platforms.map((platform) => <label key={platform}>{platform} 链接<input type="url" value={form.publishLinks[platform] || ""} onChange={(e) => onChange({ ...form, publishLinks: { ...form.publishLinks, [platform]: e.target.value } })} placeholder="https://" /></label>)}</div>
      <label>归档备注<textarea value={form.archiveNotes} onChange={(e) => onChange({ ...form, archiveNotes: e.target.value })} placeholder="选题来源、素材位置、复盘结论或待补信息" /></label>
      <div className="history-metrics"><strong>首轮数据记录（以后仍可在内容详情中修改）</strong>{form.platforms.map((platform) => { const metric = form.metrics.find((item) => item.platform === platform)!; return <fieldset key={platform}><legend>{platform}</legend><div>{(["views", "likes", "saves", "comments", "shares", "follows"] as const).map((field) => <label key={field}>{({ views: "播放", likes: "点赞", saves: "收藏", comments: "评论", shares: "转发", follows: "关注" })[field]}<input type="number" min="0" value={metric[field]} onChange={(e) => onMetric(platform, field, Math.max(0, Number(e.target.value)))} /></label>)}</div></fieldset>; })}</div>
    </div>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={onSave}>保存到内容库</button></div>
  </section></div>;
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return <div className="detail-block"><span>{label}</span><p>{text || "待补充"}</p></div>;
}

function PlatformBars({ contents }: { contents: ContentItem[] }) {
  const values = platforms.map((platform) => ({ platform, views: contents.reduce((sum, item) => sum + (item.metrics.find((metric) => metric.platform === platform)?.views ?? 0), 0) }));
  const max = Math.max(...values.map((item) => item.views), 1);
  return <div className="bar-chart">{values.map((item) => <div className="bar-item" key={item.platform}><div className="bar-label"><strong>{item.platform}</strong><span>{formatNumber(item.views)}</span></div><div className="bar-track"><i style={{ width: `${(item.views / max) * 100}%` }} /></div></div>)}</div>;
}

function RecordingModeComparison({ contents }: { contents: ContentItem[] }) {
  const modes: RecordingMode[] = ["出镜口播", "HTML录屏", "混合录制"];
  const values = modes.map((mode) => {
    const matched = contents.filter((item) => item.recordingMode === mode);
    const totals = matched.flatMap((item) => item.metrics).reduce((sum, metric) => ({ views: sum.views + metric.views, saves: sum.saves + metric.saves, follows: sum.follows + metric.follows }), { views: 0, saves: 0, follows: 0 });
    return { mode, count: matched.length, ...totals };
  });
  return <div className="format-comparison">{values.map((item) => <article key={item.mode}><span className="format-icon">{recordingModeCopy[item.mode].icon}</span><div><small>{item.count} 条内容</small><h3>{item.mode}</h3></div><dl><div><dt>播放</dt><dd>{formatNumber(item.views)}</dd></div><div><dt>收藏率</dt><dd>{item.views ? `${((item.saves / item.views) * 100).toFixed(1)}%` : "—"}</dd></div><div><dt>关注转化</dt><dd>{item.views ? `${((item.follows / item.views) * 100).toFixed(2)}%` : "—"}</dd></div></dl></article>)}</div>;
}
