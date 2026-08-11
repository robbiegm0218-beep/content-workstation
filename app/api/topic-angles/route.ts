type CreatorContext = {
  role?: string;
  experience?: string;
  audience?: string;
  style?: string;
  goal?: string;
};

type CaseContext = {
  title?: string;
  industry?: string;
  background?: string;
  result?: string;
};

type RequestBody = {
  topic?: string;
  creator?: CreatorContext;
  cases?: CaseContext[];
};

type ProviderResult = {
  text: string;
  label: string;
};

function apiErrorMessage(payload: Record<string, unknown>) {
  if (typeof payload.error === "string") return payload.error;
  if (payload.error && typeof payload.error === "object" && typeof (payload.error as { message?: unknown }).message === "string") {
    return (payload.error as { message: string }).message;
  }
  return "";
}

function extractOpenAIText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: string }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return "";
}

async function callDeepSeek(instructions: string, input: string): Promise<ProviderResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("PROVIDER_KEY_MISSING:请在 .env.local 中配置 DEEPSEEK_API_KEY。");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input },
      ],
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      max_tokens: 2200,
      stream: false,
    }),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 401) throw new Error("PROVIDER_KEY_INVALID:DeepSeek API 密钥无效。");
    if (response.status === 429) throw new Error("PROVIDER_RATE_LIMIT:DeepSeek 调用达到限额，请稍后重试或检查余额。");
    throw new Error(`PROVIDER_ERROR:${apiErrorMessage(payload) || "DeepSeek 生成失败。"}`);
  }
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const text = typeof first?.message?.content === "string" ? first.message.content : "";
  if (!text) throw new Error("PROVIDER_EMPTY:DeepSeek 没有返回内容，请重试。");
  return { text, label: `DeepSeek · ${model}` };
}

async function callOpenAI(instructions: string, input: string): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("PROVIDER_KEY_MISSING:请在 .env.local 中配置 OPENAI_API_KEY。");
  const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: 2200,
      store: false,
      text: {
        verbosity: "medium",
        format: {
          type: "json_schema",
          name: "topic_angle_recommendations",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["angles"],
            properties: {
              angles: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "title", "viewpoint", "audiencePain", "contentValue", "evidenceNeeded"],
                  properties: {
                    type: { type: "string" },
                    title: { type: "string" },
                    viewpoint: { type: "string" },
                    audiencePain: { type: "string" },
                    contentValue: { type: "string" },
                    evidenceNeeded: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 401) throw new Error("PROVIDER_KEY_INVALID:OpenAI API 密钥无效。");
    if (response.status === 429) throw new Error("PROVIDER_RATE_LIMIT:OpenAI 调用达到限额，请稍后重试或检查余额。");
    throw new Error(`PROVIDER_ERROR:${apiErrorMessage(payload) || "OpenAI 生成失败。"}`);
  }
  const text = extractOpenAIText(payload);
  if (!text) throw new Error("PROVIDER_EMPTY:OpenAI 没有返回内容，请重试。");
  return { text, label: `OpenAI · ${model}` };
}

function parseProviderError(error: unknown) {
  const raw = error instanceof Error ? error.message : "PROVIDER_ERROR:未知错误";
  const separator = raw.indexOf(":");
  const code = separator >= 0 ? raw.slice(0, separator) : "PROVIDER_ERROR";
  const message = separator >= 0 ? raw.slice(separator + 1) : raw;
  const status = code === "PROVIDER_RATE_LIMIT" ? 429 : code === "PROVIDER_KEY_MISSING" || code === "PROVIDER_KEY_INVALID" ? 503 : 502;
  return { message, status };
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "请求内容格式不正确。" }, { status: 400 });
  }

  const topic = body.topic?.trim();
  if (!topic) return Response.json({ error: "请先输入想研究的议题。" }, { status: 400 });
  if (topic.length > 160) return Response.json({ error: "议题过长，请收敛到 160 个字以内。" }, { status: 400 });

  const configuredProvider = process.env.CONTENT_AI_PROVIDER?.toLowerCase();
  const provider = configuredProvider || (process.env.DEEPSEEK_API_KEY ? "deepseek" : process.env.OPENAI_API_KEY ? "openai" : "");
  if (!provider) return Response.json({ error: "动态生成尚未配置模型密钥。请配置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后重启应用。" }, { status: 503 });
  if (provider !== "deepseek" && provider !== "openai") return Response.json({ error: "CONTENT_AI_PROVIDER 仅支持 deepseek 或 openai。" }, { status: 503 });

  const creator = body.creator ?? {};
  const cases = (body.cases ?? []).slice(0, 8);
  const caseText = cases.length
    ? cases.map((item, index) => `${index + 1}. ${item.title || "未命名案例"}｜${item.industry || "未分类"}｜${item.background || "背景待补充"}｜${item.result || "结果待补充"}`).join("\n")
    : "暂无可用案例；需要案例时明确标记待补充，不得虚构。";

  const instructions = `你是内容工作站里的资深选题策划。根据创作者的真实背景和目标受众，为一个议题生成三个彼此明显不同、能实际展开的内容角度。\n\n要求：\n- 三个角度不能只是替换标题词语，核心冲突、受众问题和内容价值必须不同。\n- 优先给出真实场景、判断框架和经验迁移，不写泛泛的概念科普。\n- 不虚构创作者经历、项目结果、平台热度或数据。\n- 没有证据支撑的部分写入 evidenceNeeded，提醒创作者补充。\n- 标题有吸引力但不制造焦虑，不承诺正文无法兑现的结果。\n- 使用简体中文，语气接地气、理性专业。\n- 只输出一个合法 JSON 对象，不添加 Markdown 或解释。\n- JSON 必须严格采用这个结构：{"angles":[{"type":"角度类型","title":"标题","viewpoint":"核心观点","audiencePain":"受众痛点","contentValue":"内容价值","evidenceNeeded":"需要补充的证据"}]}，angles 必须正好包含 3 项。`;

  const input = `【议题】\n${topic}\n\n【创作者身份】\n${creator.role || "待补充"}\n\n【创作者经历】\n${creator.experience || "待补充"}\n\n【目标受众】\n${creator.audience || "待补充"}\n\n【表达风格】\n${creator.style || "待补充"}\n\n【内容目标】\n${creator.goal || "待补充"}\n\n【可用真实案例】\n${caseText}\n\n请生成三个差异明显的内容切入角度，并为每个角度说明受众痛点、核心观点、内容价值和需要补充的证据。请返回 JSON。`;

  try {
    const result = provider === "deepseek" ? await callDeepSeek(instructions, input) : await callOpenAI(instructions, input);
    const parsed = JSON.parse(result.text) as { angles?: unknown[] };
    if (!Array.isArray(parsed.angles) || parsed.angles.length !== 3) return Response.json({ error: "模型返回的角度数量不正确，请重试。" }, { status: 502 });
    return Response.json({ angles: parsed.angles, model: result.label, provider });
  } catch (error) {
    const parsed = parseProviderError(error);
    return Response.json({ error: parsed.message }, { status: parsed.status });
  }
}
