"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "dashboard" | "create" | "library" | "cases" | "review" | "settings";
type ContentStatus = "选题草稿" | "待生成" | "已生成" | "待录制" | "已录制" | "已发布" | "已复盘";
type Platform = "B站" | "小红书" | "视频号" | "抖音";
type RecordingMode = "出镜口播" | "HTML录屏" | "混合录制" | "未设置";
type DraftState = "未生成" | "编辑中" | "已确认";
type AssetState = "未开始" | "待生成" | "已生成";
type HtmlStyle = "专业科技" | "极简信息图" | "杂志卡片" | "白板讲解";
type CoverStyle = "高对比科技" | "大字观点" | "杂志编辑" | "人物留白";
type ContentOrigin = "工作站创作" | "历史归档";

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
  htmlStyle: HtmlStyle;
  coverStyle: CoverStyle;
  metrics: Metric[];
  origin: ContentOrigin;
  publishedAt: string;
  publishLinks: Partial<Record<Platform, string>>;
  archiveNotes: string;
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
const coverStyles: Record<CoverStyle, { mark: string; description: string }> = {
  高对比科技: { mark: "亮", description: "深底亮色，适合 AI、系统与技术实战。" },
  大字观点: { mark: "字", description: "文字占主视觉，适合冲突判断和强结论。" },
  杂志编辑: { mark: "刊", description: "克制、有质感，适合长期专业账号。" },
  人物留白: { mark: "人", description: "预留人物位置，适合出镜账号增强识别度。" },
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
const recordingGuidance: Record<Exclude<RecordingMode, "未设置">, string> = {
  出镜口播: "以出镜表达为主。稿件按提词器可读性分段，标出停顿、重音、字幕和补充素材插入点，避免连续照稿朗读。",
  HTML录屏: "以静态 HTML 页面录屏为主。页面从上至下与口播严格对应，页面标题用于观看而非全部朗读，并标明滚动、停留和切屏位置。",
  混合录制: "采用出镜开场 20～30 秒、HTML 录屏主体、出镜总结 20～30 秒的结构；标明每次切换的时间点、画面、口播和转场目的。",
};

function productionPlanFor(mode: Exclude<RecordingMode, "未设置">) {
  if (mode === "出镜口播") return "出镜开场 → 观点与案例口播 → 穿插素材/B-roll → 出镜总结与 CTA";
  if (mode === "HTML录屏") return "问题页 → 核心判断页 → 方法/案例页 → 行动清单页；按页面顺序完成录屏与旁白";
  return "出镜开场 20～30 秒 → HTML 主体 4～6 分钟 → 必要时切回出镜强调经历 → 出镜总结 20～30 秒";
}

function contentTaskPromptForItem(item: ContentItem, settings: Settings) {
  return `请使用 product-manager-content-creator Skill，先完成这期视频的“内容草稿”。

【本次只做内容】
- 不生成 HTML 页面，不生成封面图，不进入视觉设计。
- 输出 Markdown，方便我回填到内容工作站继续编辑。

【账号背景】
- 身份：${settings.role}
- 经历：${settings.experience}
- 目标受众：${settings.audience}
- 表达风格：${settings.style}
- 内容目标：${settings.goal}

【选题简报】
- 主标题：${item.title}
- 副标题：${item.subtitle}
- 目标人群：${item.audience}
- 受众痛点：${item.pain || "待补充"}
- 核心观点：${item.viewpoint || "待补充"}
- 可用案例：${item.cases || "信息不足时标记待补充，不得虚构"}
- 视频时长与呈现：${item.recordingMode}，${item.productionPlan}
- 发布平台：${item.platforms.join("、")}

【本阶段需要输出】
1. 3 个副标题候选并推荐 1 个
2. 完整视频口播稿
3. 内容段落与时间轴
4. 素材插入建议
5. 四平台发布文案
6. 需要补充的真实案例问题
7. 内容结构与标题安排原因

避免定义堆砌和 AI 腔，按“场景 → 问题 → 我的判断 → 怎么做 → 总结行动”推进；只使用已提供的个人经历。`;
}

function htmlTaskPromptFor(item: ContentItem, settings: Settings) {
  return `请使用 product-manager-content-creator Skill，只为下面这条已经确认的内容制作静态 HTML 录屏页。

【重要边界】
- 内容稿已经人工确认，不要重写观点、案例和口播顺序。
- 本次只生成 HTML 演示页及页面与口播映射，不生成封面图，不扩展新的内容结论。
- HTML 必须是单文件，可直接打开，并按口播顺序从上到下录制。

【账号与呈现】
- 身份：${settings.role}
- 表达风格：${settings.style}
- 呈现方式：${item.recordingMode}
- HTML 视觉风格：${item.htmlStyle}｜${htmlStyles[item.htmlStyle].description}

【内容标题】
${item.title}
${item.subtitle}

【已确认内容稿】
${item.script}

【需要输出】
1. 静态 HTML 文件
2. 页面顺序与口播段落映射
3. 每屏建议停留时间和切换提示
4. 说明如何落实“${item.htmlStyle}”风格，同时保证录屏可读性

不要用大段定义铺满页面；一屏只表达一个判断，屏幕文字用于辅助观看，不要把整段口播原样堆到页面。`;
}

function coverTaskPromptFor(item: ContentItem, settings: Settings) {
  return `请使用 product-manager-content-creator Skill 和 imagegen Skill，只为下面这条已经确认的内容制作封面图。

【重要边界】
- 内容稿和标题已经人工确认，不重写正文，不生成 HTML。
- 分别生成 16:9、4:3、3:4 三张独立构图，不使用同一张图机械裁切。
- 三张图保持同一视觉识别，瀑布流小图下主标题仍清晰。

【账号与封面】
- 身份：${settings.role}
- 账号风格：${settings.style}
- 封面视觉风格：${item.coverStyle}｜${coverStyles[item.coverStyle].description}

【内容标题】
- 主标题：${item.title}
- 副标题：${item.subtitle}

【已确认内容摘要】
${item.script.slice(0, 1800)}

【需要输出】
1. 16:9 封面图
2. 4:3 封面图
3. 3:4 封面图
4. 三个尺寸的安全区、标题层级和构图说明

先提炼不超过两层的封面短文案，再生成图片；不要把完整标题和内容目录全部塞进封面。`;
}

function productionStagesFor(item: ContentItem) {
  const needsHtml = item.recordingMode === "HTML录屏" || item.recordingMode === "混合录制";
  const recorded = ["已录制", "已发布", "已复盘"].includes(item.status);
  const published = ["已发布", "已复盘"].includes(item.status);
  return [
    { title: "选题简报", description: "标题、人群和核心观点已进入内容库", done: Boolean(item.title.trim()) },
    { title: "内容草稿", description: "生成并回填可编辑的完整稿件", done: Boolean(item.script.trim()) },
    { title: "确认内容", description: "人工确认后才进入视觉制作", done: item.draftState === "已确认" },
    { title: needsHtml ? "HTML 录屏页" : "画面素材方案", description: needsHtml ? `当前风格：${item.htmlStyle}` : "出镜内容无需 HTML 页面", done: !needsHtml || item.htmlState === "已生成" },
    { title: "三尺寸封面", description: `当前风格：${item.coverStyle}`, done: item.coverState === "已生成" },
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
      htmlStyle: item.htmlStyle || "专业科技",
      coverStyle: item.coverStyle || "高对比科技",
      origin: item.origin || "工作站创作",
      publishedAt: item.publishedAt || "",
      publishLinks: item.publishLinks || {},
      archiveNotes: item.archiveNotes || "",
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
  { id: "settings", label: "账号设置", icon: "◎", eyebrow: "PROFILE" },
];

const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: "CONTENT OPERATING SYSTEM", title: "今天，内容推进到哪一步？", description: "把想法、制作和数据放在一个地方，下一步会更清楚。" },
  create: { eyebrow: "NEW CONTENT BRIEF", title: "先把选题说清楚，再让 AI 动笔", description: "真实经历是内容的底稿，AI 负责整理、适配和提效。" },
  library: { eyebrow: "CONTENT LIBRARY", title: "每条内容都应该留下资产", description: "统一管理选题、稿件、封面、状态和发布结果。" },
  cases: { eyebrow: "EXPERIENCE BANK", title: "把十年经历，变成可复用的表达素材", description: "好的案例不是简历描述，而是观点成立的证据。" },
  review: { eyebrow: "PERFORMANCE REVIEW", title: "不只看播放，还要看内容带来了什么", description: "用收藏、关注和互动判断专业内容是否真的有用。" },
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
  const [taskPayload, setTaskPayload] = useState<{ eyebrow: string; title: string; description: string; prompt: string } | null>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const [scoutTopic, setScoutTopic] = useState("");
  const [topicAngles, setTopicAngles] = useState<TopicAngle[]>([]);
  const [anglesLoading, setAnglesLoading] = useState(false);
  const [anglesError, setAnglesError] = useState("");
  const [anglesModel, setAnglesModel] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "全部">("全部");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState<HistoryForm>(initialHistoryForm);
  const [caseDraft, setCaseDraft] = useState({ title: "", industry: "", background: "", result: "" });
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setDb(normalizeDatabase(JSON.parse(saved) as Database));
        } else {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const migrated = normalizeDatabase(JSON.parse(legacy) as Database);
            setDb(migrated);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
      } catch {
        setNotice("本地数据读取失败，已加载演示数据。");
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }, [db, ready]);

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

  const contentTaskPrompt = useMemo(() => {
    return `请使用 product-manager-content-creator Skill，先为我的个人账号完成本期“内容草稿”。\n\n【本次只做内容】\n- 先生成可编辑、可确认的内容稿。\n- 不生成 HTML 页面，不生成封面图，不进入视觉设计。\n- 内容确认以后，我会再单独发起 HTML 和封面任务。\n\n【账号背景】\n- 身份：${db.settings.role}\n- 经历：${db.settings.experience}\n- 目标受众：${db.settings.audience}\n- 表达风格：${db.settings.style}\n- 内容目标：${db.settings.goal}\n\n【本期选题】\n- 主标题：${form.title || "（请补充）"}\n- 副标题：${form.subtitle || "请提供 3 个候选并推荐 1 个"}\n- 为什么现在讲：${form.whyNow || "（请补充）"}\n- 目标人群：${form.audience || db.settings.audience}\n- 受众痛点：${form.pain || "（请补充）"}\n- 核心观点：${form.viewpoint || "（请补充）"}\n- 参考素材：${form.sources || "无"}\n- 可使用的亲身案例：${form.cases || "请优先从案例库方向中判断，如信息不足请标记待补充，不要虚构。"}\n- 视频时长：${form.duration}\n- 呈现方式：${form.recordingMode}\n- 发布平台：${form.platforms.join("、")}\n\n【内容结构要求】\n${recordingGuidance[form.recordingMode]}\n\n【本阶段需要输出】\n1. 3 个副标题候选并推荐 1 个\n2. 补充受众痛点和核心冲突\n3. 完整视频口播稿\n4. 与口播对应的内容段落和时间轴\n5. 素材插入建议\n6. 四平台发布文案\n7. 需要我补充的真实案例问题\n\n【具体要求】\n1. 口播稿避免定义堆砌和 AI 腔，用一次真实工作场景或判断冲突开场。\n2. 按“场景 → 问题 → 我的判断 → 怎么做 → 总结行动”推进，保留接地气、理性专业的表达。\n3. 如果引用我的经历，只使用已提供信息；缺少细节时先列出需补充的问题。\n4. 严格按照本期选择的“${form.recordingMode}”安排内容段落和录制节奏。\n5. 结尾说明内容结构与标题这样安排的原因。\n6. 输出 Markdown，便于我在工作站中继续编辑。`;
  }, [db.settings, form]);

  const researchPrompt = useMemo(() => {
    const topic = scoutTopic.trim() || "（请填写议题）";
    return `请使用 product-manager-content-creator Skill，并联网调研“${topic}”在 B站、小红书、视频号中的相似内容，帮助我判断是否值得做成一期视频。\n\n【我的账号】\n- 身份：${db.settings.role}\n- 目标受众：${db.settings.audience}\n- 内容风格：${db.settings.style}\n\n【调研要求】\n1. 每个平台寻找 5～10 条高度相关内容，记录标题、发布时间、作者、可见互动数据、链接和内容角度。\n2. 优先近 12 个月内容；如果平台内容无法公开访问，明确写“需要人工补充”，不要虚构标题或数据。\n3. 分析高频标题表达、受众正在追问的问题、已经被讲烂的角度，以及仍有空间的内容缺口。\n4. 不要只按播放量排序，还要判断哪些内容更可能带来收藏、讨论和专业关注。\n5. 结合我的实战型产品负责人定位，给出 3 个差异化选题角度。每个角度包含：目标人群痛点、核心冲突、我的独特视角、推荐标题、需要补充的亲身案例。\n6. 最后明确推荐一个角度，并说明为什么它比直接讲“${topic}是什么”更值得做。`;
  }, [db.settings, scoutTopic]);

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
      htmlStyle: "专业科技",
      coverStyle: "高对比科技",
      metrics: emptyMetrics(),
      origin: "工作站创作",
      publishedAt: "",
      publishLinks: {},
      archiveNotes: "",
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
    if (!saveDraft()) return;
    setTaskPayload({ eyebrow: "CONTENT DRAFT", title: "第一阶段：只生成内容", description: "生成后直接回到本页粘贴、编辑和确认，不需要再进入内容库。", prompt: contentTaskPrompt });
  }

  async function copyTask() {
    if (!taskPayload) return;
    try {
      await navigator.clipboard.writeText(taskPayload.prompt);
      setNotice("Codex 任务指令已复制，可以直接粘贴使用。");
    } catch {
      setNotice("复制失败，请在任务面板中手动选择文本。");
    }
  }

  async function copyResearchTask() {
    try {
      await navigator.clipboard.writeText(researchPrompt);
      setNotice("选题调研指令已复制，可以交给 Codex 联网分析。");
    } catch {
      setNotice("复制失败，请在调研面板中手动选择文本。");
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
    setAnglesLoading(true);
    setAnglesError("");
    setTopicAngles([]);
    try {
      const response = await fetch("/api/topic-angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          creator: db.settings,
          cases: db.cases.slice(0, 8).map((item) => ({ title: item.title, industry: item.industry, background: item.background, result: item.result })),
        }),
      });
      const result = await response.json() as { angles?: TopicAngle[]; model?: string; error?: string };
      if (!response.ok || !result.angles) throw new Error(result.error || "生成失败，请稍后重试。");
      setTopicAngles(result.angles);
      setAnglesModel(result.model || "OpenAI");
      setNotice("已生成 3 个动态选题角度。");
    } catch (error) {
      setAnglesError(error instanceof Error ? error.message : "生成失败，请稍后重试。");
    } finally {
      setAnglesLoading(false);
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
        updatedAt: today(),
      } : content),
    }));
    setNotice("内容稿已确认，现在可以分别制作 HTML 和封面。 ");
  }

  function updateHtmlStyle(id: string, style: HtmlStyle) {
    setDb((current) => ({ ...current, contents: current.contents.map((item) => item.id === id ? { ...item, htmlStyle: style, htmlState: item.htmlState === "已生成" ? "待生成" : item.htmlState, updatedAt: today() } : item) }));
  }

  function updateCoverStyle(id: string, style: CoverStyle) {
    setDb((current) => ({ ...current, contents: current.contents.map((item) => item.id === id ? { ...item, coverStyle: style, coverState: item.coverState === "已生成" ? "待生成" : item.coverState, updatedAt: today() } : item) }));
  }

  function updateAssetState(id: string, kind: "html" | "cover", state: AssetState) {
    setDb((current) => ({
      ...current,
      contents: current.contents.map((item) => item.id === id ? { ...item, [kind === "html" ? "htmlState" : "coverState"]: state, updatedAt: today() } : item),
    }));
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
      htmlStyle: "专业科技",
      coverStyle: "高对比科技",
      metrics: historyForm.metrics,
      origin: "历史归档",
      publishedAt: historyForm.publishedAt,
      publishLinks: historyForm.publishLinks,
      archiveNotes: historyForm.archiveNotes,
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
          <p>内容只保存在这台设备的浏览器中，请定期导出备份。</p>
        </div>
        <div className="profile-mini">
          <span className="avatar">R</span>
          <span><strong>{db.settings.name}</strong><small>10 年产品实战</small></span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">{viewCopy[view].eyebrow}</span>
            <h1>{viewCopy[view].title}</h1>
            <p>{viewCopy[view].description}</p>
          </div>
          <button className="primary-button top-create" onClick={startNewContent}><span>＋</span> 新建一期内容</button>
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
                  <div><span className="eyebrow">TOPIC RADAR</span><h2>先看看别人怎么讲，再决定你讲什么</h2><p>平台检索找同类，AI结合账号资料实时生成差异化切入角度。</p></div>
                  <span className="beta-badge">选题推荐 · BETA</span>
                </div>
                <div className="scout-search">
                  <label><span>想调研的议题</span><span className="scout-input-row"><input value={scoutTopic} onChange={(e) => { setScoutTopic(e.target.value); setTopicAngles([]); setAnglesError(""); }} onKeyDown={(e) => { if (e.key === "Enter") void generateTopicAngles(); }} placeholder="例如：产品经理如何做 Agent 需求判断" /><button type="button" className="generate-angle-button" onClick={() => void generateTopicAngles()} disabled={!scoutTopic.trim() || anglesLoading}>{anglesLoading ? "正在生成…" : "AI 生成 3 个角度"}</button></span></label>
                  <div className="scout-actions">
                    <a className={`platform-search ${!scoutTopic.trim() ? "disabled" : ""}`} href={scoutTopic.trim() ? `https://search.bilibili.com/all?keyword=${encodeURIComponent(scoutTopic.trim())}` : undefined} target="_blank" rel="noreferrer"><strong>B</strong><span>查 B站<small>打开关键词搜索</small></span></a>
                    <a className={`platform-search red ${!scoutTopic.trim() ? "disabled" : ""}`} href={scoutTopic.trim() ? `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(scoutTopic.trim())}` : undefined} target="_blank" rel="noreferrer"><strong>RED</strong><span>查小红书<small>可能需要登录</small></span></a>
                    <button className="platform-search green" onClick={copyForWechat} disabled={!scoutTopic.trim()}><strong>微</strong><span>查视频号<small>复制词去搜一搜</small></span></button>
                    <button className="platform-search codex" onClick={() => setResearchOpen(true)} disabled={!scoutTopic.trim()}><strong>✦</strong><span>交给 Codex<small>联网归纳同类选题</small></span></button>
                  </div>
                  <ol className="scout-flow" aria-label="选题调研下一步">
                    <li className={scoutTopic.trim() ? "done" : "current"}><span>1</span><p><strong>输入议题</strong><small>先写你想研究的问题</small></p></li>
                    <li className={scoutTopic.trim() ? "current" : ""}><span>2</span><p><strong>查看同类</strong><small>每个平台先看 5～10 条</small></p></li>
                    <li><span>3</span><p><strong>Codex 归纳</strong><small>找高频角度与内容空白</small></p></li>
                    <li><span>4</span><p><strong>确定切口</strong><small>带入简报并补真实案例</small></p></li>
                  </ol>
                </div>
                {anglesLoading && <div className="angle-results"><div className="angle-title"><strong>正在结合账号定位生成角度</strong><span>模型实时分析中</span></div><div className="angle-grid loading">{[1, 2, 3].map((item) => <article key={item}><i /><i /><i /><i /></article>)}</div></div>}
                {anglesError && <div className="angle-error"><strong>暂时无法生成</strong><p>{anglesError}</p><small>如果提示尚未配置，请在本地环境中设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后重启应用。</small></div>}
                {topicAngles.length > 0 && <div className="angle-results"><div className="angle-title"><strong>AI 实时生成的 3 个切入角度</strong><span>{anglesModel} · 基于当前议题与账号资料</span></div><div className="angle-grid dynamic">{topicAngles.map((angle) => <article key={`${angle.type}-${angle.title}`}><span>{angle.type}</span><h3>{angle.title}</h3><p>{angle.viewpoint}</p><dl><div><dt>受众痛点</dt><dd>{angle.audiencePain}</dd></div><div><dt>内容价值</dt><dd>{angle.contentValue}</dd></div><div><dt>需要证据</dt><dd>{angle.evidenceNeeded}</dd></div></dl><button onClick={() => applyAngle(angle)}>用这个角度写 →</button></article>)}</div></div>}
                <div className="feasibility-note"><strong>当前能力边界</strong><p>三个角度由模型结合议题、账号资料和案例实时生成，不再使用固定模板。B站、小红书和视频号的真实平台样本仍通过上方入口查看；模型不会虚构平台热度或互动数据。</p></div>
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

              <div className="form-actions"><button className="secondary-button" onClick={saveDraft}>{workingContent ? "更新当前选题" : "保存选题草稿"}</button><button className="primary-button" onClick={openContentTask}>生成内容任务指令 →</button></div>
              {workingContent && <InlineCreationWorkflow
                item={workingContent}
                onScript={(script) => updateContentScript(workingContent.id, script)}
                onConfirm={() => confirmContentScript(workingContent.id)}
                onHtmlStyle={(style) => updateHtmlStyle(workingContent.id, style)}
                onCoverStyle={(style) => updateCoverStyle(workingContent.id, style)}
                onAssetState={(kind, state) => updateAssetState(workingContent.id, kind, state)}
                onTask={(kind) => setTaskPayload(kind === "content" ? {
                  eyebrow: "CONTENT DRAFT",
                  title: "第一阶段：生成内容草稿",
                  description: "生成后直接回到当前页面粘贴、编辑并确认。",
                  prompt: contentTaskPromptForItem(workingContent, db.settings),
                } : kind === "html" ? {
                  eyebrow: "HTML PRODUCTION",
                  title: "第三阶段：生成 HTML",
                  description: `使用“${workingContent.htmlStyle}”风格，只制作录屏页面。`,
                  prompt: htmlTaskPromptFor(workingContent, db.settings),
                } : {
                  eyebrow: "COVER PRODUCTION",
                  title: "第三阶段：生成三尺寸封面",
                  description: `使用“${workingContent.coverStyle}”风格，只制作封面图。`,
                  prompt: coverTaskPromptFor(workingContent, db.settings),
                })}
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
                onStatus={(status) => changeStatus(selected.id, status)}
                onRecordingMode={(mode) => changeContentRecordingMode(selected.id, mode)}
                onScript={(script) => updateContentScript(selected.id, script)}
                onConfirm={() => confirmContentScript(selected.id)}
                onHtmlStyle={(style) => updateHtmlStyle(selected.id, style)}
                onCoverStyle={(style) => updateCoverStyle(selected.id, style)}
                onAssetState={(kind, state) => updateAssetState(selected.id, kind, state)}
                onTask={(kind) => setTaskPayload(kind === "content" ? {
                  eyebrow: "CONTENT DRAFT",
                  title: "第一阶段：生成内容草稿",
                  description: "只生成可编辑内容，不生成 HTML 和封面。",
                  prompt: contentTaskPromptForItem(selected, db.settings),
                } : kind === "html" ? {
                  eyebrow: "HTML PRODUCTION",
                  title: "第三阶段：生成 HTML",
                  description: `使用“${selected.htmlStyle}”风格，只制作录屏页面。`,
                  prompt: htmlTaskPromptFor(selected, db.settings),
                } : {
                  eyebrow: "COVER PRODUCTION",
                  title: "第三阶段：生成三尺寸封面",
                  description: `使用“${selected.coverStyle}”风格，只制作封面图。`,
                  prompt: coverTaskPromptFor(selected, db.settings),
                })}
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
            <div className="panel data-tools">
              <span className="eyebrow">LOCAL DATA</span><h2>备份与迁移</h2><p>当前没有云同步。建议每次完成一期内容后导出一份 JSON 备份。</p>
              <button className="primary-button" onClick={exportData}>导出全部数据</button>
              <button className="secondary-button" onClick={() => importRef.current?.click()}>导入备份文件</button>
              <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={importData} />
              <div className="divider" />
              <button className="danger-button" onClick={clearAllContent}>清空全部内容与案例</button>
              <small>只清除内容、案例和对应运营数据；账号定位、表达风格与模型配置不会被修改。此操作无法恢复，请先导出备份。</small>
            </div>
          </section>
        )}
      </main>

      {taskPayload && <div className="modal-backdrop" role="presentation" onMouseDown={() => setTaskPayload(null)}><section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">{taskPayload.eyebrow}</span><h2 id="task-title">{taskPayload.title}</h2><p>{taskPayload.description} 当前仍需复制到 Codex 中执行。</p></div><button className="icon-button" onClick={() => setTaskPayload(null)} aria-label="关闭">×</button></div><textarea className="task-output" readOnly value={taskPayload.prompt} /><div className="modal-actions"><button className="secondary-button" onClick={() => setTaskPayload(null)}>返回继续编辑</button><button className="primary-button" onClick={copyTask}>复制任务指令</button></div></section></div>}
      {researchOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setResearchOpen(false)}><section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="research-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">TOPIC RESEARCH</span><h2 id="research-title">Codex 选题调研指令</h2><p>复制到 Codex 后，它会联网收集可访问样本，并标记需要你人工补充的视频号数据。</p></div><button className="icon-button" onClick={() => setResearchOpen(false)} aria-label="关闭">×</button></div><textarea className="task-output" readOnly value={researchPrompt} /><div className="modal-actions"><button className="secondary-button" onClick={() => setResearchOpen(false)}>暂时不用</button><button className="primary-button" onClick={copyResearchTask}>复制调研指令</button></div></section></div>}
      {historyOpen && <HistoryArchiveModal form={historyForm} onChange={setHistoryForm} onTogglePlatform={toggleHistoryPlatform} onMetric={updateHistoryMetric} onSave={addHistoricalContent} onClose={() => setHistoryOpen(false)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

function InlineCreationWorkflow({ item, onScript, onConfirm, onHtmlStyle, onCoverStyle, onAssetState, onTask }: {
  item: ContentItem;
  onScript: (script: string) => void;
  onConfirm: () => void;
  onHtmlStyle: (style: HtmlStyle) => void;
  onCoverStyle: (style: CoverStyle) => void;
  onAssetState: (kind: "html" | "cover", state: AssetState) => void;
  onTask: (kind: "content" | "html" | "cover") => void;
}) {
  const confirmed = item.draftState === "已确认";
  return <section className="inline-workflow" id="current-production">
    <div className="inline-workflow-head"><div><span className="eyebrow">CURRENT PRODUCTION</span><h2>继续完成这期内容</h2><p>选题已自动进入内容库，但后续操作都可以在当前页面完成。</p></div><strong>{item.title}</strong></div>
    <ol className="inline-stage-strip">
      <li className={item.script.trim() ? "done" : "current"}><span>1</span>内容回填</li>
      <li className={confirmed ? "done" : item.script.trim() ? "current" : ""}><span>2</span>编辑确认</li>
      <li className={confirmed ? "current" : "locked"}><span>3</span>视觉制作</li>
      <li className={item.htmlState === "已生成" && item.coverState === "已生成" ? "done" : "locked"}><span>4</span>完成交付</li>
    </ol>

    <div className="inline-editor-section">
      <div className="inline-section-head"><div><span>04 · 内容稿</span><h3>生成后直接粘贴到这里</h3></div><strong className={`light-state light-${item.draftState}`}>{item.draftState}</strong></div>
      <textarea className="inline-content-editor" value={item.script} onChange={(e) => onScript(e.target.value)} placeholder="把 Codex 返回的完整 Markdown 内容粘贴到这里。你可以直接修改、删减并补充真实案例……" />
      <div className="inline-actions"><span>{item.script.trim().length} 字符 · 自动同步到内容库</span><div><button className="secondary-button" onClick={() => onTask("content")}>{item.script.trim() ? "重新生成内容任务" : "生成内容任务"}</button><button className="primary-button" onClick={onConfirm} disabled={!item.script.trim() || confirmed}>{confirmed ? "内容已确认" : "确认内容，继续制作 →"}</button></div></div>
    </div>

    {!confirmed && <div className="inline-gate"><strong>视觉制作尚未解锁</strong><p>先完成上面的内容回填和确认。这样修改观点或口播时，不需要反复重做 HTML 和封面。</p></div>}

    {confirmed && <div className="inline-assets">
      <section>
        <div className="inline-section-head"><div><span>05 · HTML 录屏页</span><h3>选择页面风格后单独生成</h3></div><strong className={`light-state light-${item.htmlState}`}>{item.htmlState}</strong></div>
        <div className="inline-style-grid">{(Object.entries(htmlStyles) as [HtmlStyle, { mark: string; description: string }][]).map(([style, copy]) => <button className={item.htmlStyle === style ? "selected" : ""} key={style} onClick={() => onHtmlStyle(style)}><i>{copy.mark}</i><strong>{style}</strong><small>{copy.description}</small></button>)}</div>
        <div className="inline-asset-actions"><button className="primary-button" onClick={() => { onAssetState("html", "待生成"); onTask("html"); }}>生成 HTML 任务指令</button><button className="secondary-button" onClick={() => onAssetState("html", item.htmlState === "已生成" ? "待生成" : "已生成")}>{item.htmlState === "已生成" ? "重新标记为待生成" : "标记 HTML 已生成"}</button></div>
      </section>
      <section>
        <div className="inline-section-head"><div><span>06 · 三尺寸封面</span><h3>选择封面风格后单独生成</h3></div><strong className={`light-state light-${item.coverState}`}>{item.coverState}</strong></div>
        <div className="inline-style-grid">{(Object.entries(coverStyles) as [CoverStyle, { mark: string; description: string }][]).map(([style, copy]) => <button className={item.coverStyle === style ? "selected" : ""} key={style} onClick={() => onCoverStyle(style)}><i>{copy.mark}</i><strong>{style}</strong><small>{copy.description}</small></button>)}</div>
        <div className="inline-asset-actions"><button className="primary-button" onClick={() => { onAssetState("cover", "待生成"); onTask("cover"); }}>生成封面任务指令</button><button className="secondary-button" onClick={() => onAssetState("cover", item.coverState === "已生成" ? "待生成" : "已生成")}>{item.coverState === "已生成" ? "重新标记为待生成" : "标记封面已生成"}</button></div>
      </section>
    </div>}
  </section>;
}

function ContentDetail({ item, onStatus, onRecordingMode, onScript, onConfirm, onHtmlStyle, onCoverStyle, onAssetState, onTask, onMetric, onMetadata, onDelete, onClose }: {
  item: ContentItem;
  onStatus: (status: ContentStatus) => void;
  onRecordingMode: (mode: Exclude<RecordingMode, "未设置">) => void;
  onScript: (script: string) => void;
  onConfirm: () => void;
  onHtmlStyle: (style: HtmlStyle) => void;
  onCoverStyle: (style: CoverStyle) => void;
  onAssetState: (kind: "html" | "cover", state: AssetState) => void;
  onTask: (kind: "content" | "html" | "cover") => void;
  onMetric: (platform: Platform, field: keyof Omit<Metric, "platform">, value: number) => void;
  onMetadata: (patch: Partial<Pick<ContentItem, "title" | "subtitle" | "publishedAt" | "publishLinks" | "archiveNotes" | "viewpoint">>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"brief" | "script" | "production" | "deliverables" | "data">("brief");
  const contentConfirmed = item.draftState === "已确认";
  return <aside className="detail-panel">
    <div className="detail-heading"><span className="eyebrow">CONTENT DETAIL</span><div className="detail-heading-actions"><button className="detail-delete-button" onClick={onDelete}>删除内容</button><button className="icon-button" onClick={onClose} aria-label="关闭详情">×</button></div></div>
    <div className="detail-origin"><span className={`origin-badge ${item.origin === "历史归档" ? "archive" : ""}`}>{item.origin}</span>{item.publishedAt && <small>发布于 {item.publishedAt}</small>}</div>
    <h2>{item.title}</h2><p className="detail-subtitle">{item.subtitle}</p>
    <label className="status-select">当前状态<select value={item.status} onChange={(e) => onStatus(e.target.value as ContentStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
    <div className="asset-stage-strip"><span className={item.draftState === "已确认" ? "done" : "current"}>1 内容 {item.draftState}</span><i>→</i><span className={contentConfirmed ? "current" : "locked"}>2 视觉制作</span><i>→</i><span className={item.htmlState === "已生成" && item.coverState === "已生成" ? "done" : "locked"}>3 完成交付</span></div>
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
      <div className="script-head"><div><span>内容状态</span><strong className={`draft-state state-${item.draftState}`}>{item.draftState}</strong></div><small>在这里粘贴 Codex 返回内容，也可以直接修改。任何修改都会让已确认内容回到“编辑中”。</small></div>
      <label className="content-editor-label">完整内容稿<textarea className="content-editor" value={item.script} onChange={(e) => onScript(e.target.value)} placeholder="把生成的 Markdown 内容稿粘贴到这里，继续删改和补充真实案例……" /></label>
      <div className="script-actions"><span>{item.script.trim().length} 字符 · 本地自动保存</span><div><button className="secondary-button" onClick={() => onTask("content")}>{item.script.trim() ? "重新生成内容任务" : "生成内容任务"}</button><button className="primary-button" onClick={onConfirm} disabled={!item.script.trim() || contentConfirmed}>{contentConfirmed ? "内容已确认" : "确认内容，进入视觉制作 →"}</button></div></div>
    </div>}
    {tab === "production" && <div className="detail-body">
      {!contentConfirmed && <div className="production-lock"><span>锁</span><div><strong>请先确认内容稿</strong><p>HTML 和封面会读取最终标题、结构与口播。内容未确认时生成，后续修改会造成重复返工。</p><button className="secondary-button" onClick={() => setTab("script")}>去编辑内容稿</button></div></div>}
      {contentConfirmed && <>
        <div className="production-mode-head"><span>{item.recordingMode === "未设置" ? "?" : recordingModeCopy[item.recordingMode].icon}</span><div><small>已确认内容 · 呈现方式</small><strong>{item.recordingMode}</strong></div></div>
        <label className="detail-mode-select">修改录制方式<select value={item.recordingMode} onChange={(e) => onRecordingMode(e.target.value as Exclude<RecordingMode, "未设置">)}><option value="未设置" disabled>请选择</option>{recordingModes.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
        <section className="asset-builder"><div className="asset-builder-head"><div><span>HTML 录屏页</span><h3>选择页面风格</h3></div><strong className={`asset-state asset-${item.htmlState}`}>{item.htmlState}</strong></div><div className="style-grid">{(Object.entries(htmlStyles) as [HtmlStyle, { mark: string; description: string }][]).map(([style, copy]) => <button className={item.htmlStyle === style ? "selected" : ""} key={style} onClick={() => onHtmlStyle(style)}><i>{copy.mark}</i><strong>{style}</strong><small>{copy.description}</small></button>)}</div><div className="asset-actions"><button className="primary-button" onClick={() => { onAssetState("html", "待生成"); onTask("html"); }}>生成 HTML 任务指令</button>{item.htmlState !== "已生成" && <button className="secondary-button" onClick={() => onAssetState("html", "已生成")}>标记 HTML 已生成</button>}</div></section>
        <section className="asset-builder"><div className="asset-builder-head"><div><span>三尺寸封面</span><h3>选择封面风格</h3></div><strong className={`asset-state asset-${item.coverState}`}>{item.coverState}</strong></div><div className="style-grid">{(Object.entries(coverStyles) as [CoverStyle, { mark: string; description: string }][]).map(([style, copy]) => <button className={item.coverStyle === style ? "selected" : ""} key={style} onClick={() => onCoverStyle(style)}><i>{copy.mark}</i><strong>{style}</strong><small>{copy.description}</small></button>)}</div><div className="asset-actions"><button className="primary-button" onClick={() => { onAssetState("cover", "待生成"); onTask("cover"); }}>生成封面任务指令</button>{item.coverState !== "已生成" && <button className="secondary-button" onClick={() => onAssetState("cover", "已生成")}>标记封面已生成</button>}</div></section>
      </>}
    </div>}
    {tab === "deliverables" && <div className="detail-body"><div className="deliverable-status-grid"><article><span>内容稿</span><strong>{item.draftState}</strong><small>可查看、编辑并人工确认</small></article><article><span>HTML 页面</span><strong>{item.htmlState}</strong><small>{item.htmlStyle}</small></article><article><span>三尺寸封面</span><strong>{item.coverState}</strong><small>{item.coverStyle}</small></article></div><DetailBlock label="已确认内容摘要" text={item.script || "尚未回填内容稿。"} /><div className="cover-preview-row"><div className="cover-preview wide"><small>16:9 · {item.coverStyle}</small><strong>{item.title}</strong></div><div className="cover-preview square"><small>4:3 · {item.coverStyle}</small><strong>{item.title}</strong></div><div className="cover-preview portrait"><small>3:4 · {item.coverStyle}</small><strong>{item.title}</strong></div></div></div>}
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
