/**
 * Gemini·Groq·HuggingFace 에이전트 점수/분포 — AgentCategoryDonut·PDF 공통
 */

export const AGENT_ORDER = [
  { key: "gemini", label: "Gemini" },
  { key: "groq", label: "Groq" },
  { key: "hf", label: "HuggingFace" },
];

/** ResultView DETECTION 정규화와 동일 계열 */
export function normalizeAgentCategory(value) {
  const v = String(value || "").trim();
  const lower = v.toLowerCase();
  if (!v || v === "-" || lower === "uncertain") return "기타";
  if (v === "정상") return "정상";
  if (v === "허위정보") return "허위정보";
  if (v === "딥페이크") return "딥페이크";
  if (v === "금융 사기") return "금융 사기";
  if (v === "혐오/폭력") return "혐오/폭력";
  if (v === "성적 콘텐츠") return "성적 콘텐츠";
  if (v.includes("정상") || lower.includes("normal")) return "정상";
  if (
    v.includes("허위") ||
    v.includes("가짜") ||
    lower.includes("misinfo") ||
    lower.includes("fake")
  )
    return "허위정보";
  if (
    v.includes("딥페이크") ||
    lower.includes("deepfake") ||
    lower.includes("synthetic")
  )
    return "딥페이크";
  if (
    v.includes("금융") ||
    v.includes("사기") ||
    lower.includes("scam") ||
    lower.includes("phishing")
  )
    return "금융 사기";
  if (
    v.includes("혐오") ||
    v.includes("폭력") ||
    lower.includes("hate") ||
    lower.includes("violence")
  )
    return "혐오/폭력";
  if (
    v.includes("성적") ||
    lower.includes("sexual") ||
    lower.includes("nudity")
  )
    return "성적 콘텐츠";
  return "기타";
}

/**
 * 에이전트 막대·도넛 가중치 공통 — 웹 AgentScoreBarChart와 동일 규칙
 * (risk_score를 Gemini식 0~100 우선, Groq/HF식 0~1은 확대)
 */
export function extractAgentBarScore(agent) {
  if (!agent || agent.error || agent.skipped) return null;
  if (typeof agent.risk_score === "number" && !Number.isNaN(agent.risk_score)) {
    let v = agent.risk_score;
    if (v > 0 && v <= 1) v *= 100;
    return Math.round(Math.min(100, Math.max(0, v)));
  }
  if (typeof agent.score01 === "number" && !Number.isNaN(agent.score01)) {
    return Math.round(Math.min(100, Math.max(0, agent.score01 * 100)));
  }
  if (typeof agent.score === "number" && !Number.isNaN(agent.score)) {
    let v = agent.score;
    if (v > 0 && v <= 1) v *= 100;
    return Math.round(Math.min(100, Math.max(0, v)));
  }
  if (typeof agent.confidence === "number" && !Number.isNaN(agent.confidence)) {
    let v = agent.confidence;
    if (v > 0 && v <= 1) v *= 100;
    return Math.round(Math.min(100, Math.max(0, v)));
  }
  return null;
}

/** @deprecated 이름 호환 — 항상 extractAgentBarScore와 동일 */
export function pctFromAgent(agent) {
  return extractAgentBarScore(agent);
}

/** 웹·PDF 막대 행 — AGENT_ORDER 순서 */
export function buildAgentScoreRows(agents) {
  return AGENT_ORDER.map(({ key, label }) => {
    const a = agents?.[key];
    const skipped = Boolean(a?.skipped || a?.error);
    if (skipped) return { key, label, skipped: true, score: null };
    const score = extractAgentBarScore(a);
    if (score == null) return { key, label, skipped: true, score: null };
    return { key, label, skipped: false, score };
  });
}

export function categoryFromAgent(agent) {
  if (!agent || agent.error || agent.skipped) return null;
  const cats = agent.categories;
  const firstCat = Array.isArray(cats) && cats.length ? cats[0] : null;
  return normalizeAgentCategory(
    agent.risk_category ||
      agent.category ||
      agent.detection ||
      firstCat ||
      "기타",
  );
}

export function barFill(pct) {
  if (pct == null) return "#cbd5e1";
  const r = pct / 100;
  if (r >= 0.67) return "#ea580c";
  if (r >= 0.34) return "#f59e0b";
  return "#10b981";
}

/** 메인 리스크 차트(4단계)와 맞춘 한국어 구간 — 작은 %도 ‘낮음/보통…’으로 해석 가능 */
export function riskBandKoFromPct(pct) {
  if (pct == null || typeof pct !== "number") return { label: "—", band: "none" };
  if (pct <= 33) return { label: "낮음", band: "low" };
  if (pct <= 50) return { label: "보통", band: "moderate" };
  if (pct <= 66) return { label: "높음", band: "high" };
  return { label: "매우 높음", band: "critical" };
}

/**
 * 카테고리 도넛 전용 팔레트 — AgentScoreBarChart의 모델 구분색(파랑·보라·청록)과 겹치지 않게
 * (보라=Groq vs 보라=허위정보처럼 보이는 혼동 방지)
 */
const DONUT_COLORS = {
  "혐오/폭력": "#be123c",
  "금융 사기": "#b45309",
  허위정보: "#b91c1c",
  딥페이크: "#ea580c",
  "성적 콘텐츠": "#a21caf",
  정상: "#15803d",
  기타: "#57534e",
};

function donutColor(name) {
  return DONUT_COLORS[name] || "#64748b";
}

export function buildDonutSlices(agents, finalCategory) {
  const weights = {};
  for (const { key } of AGENT_ORDER) {
    const a = agents?.[key];
    const pct = pctFromAgent(a);
    const cat = categoryFromAgent(a);
    if (pct == null || !cat) continue;
    weights[cat] = (weights[cat] || 0) + pct;
  }
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    const fb = normalizeAgentCategory(finalCategory || "기타");
    return [{ name: fb, value: 100, fill: donutColor(fb) }];
  }
  const sum = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return entries.map(([name, v]) => ({
    name,
    value: Math.max(1, Math.round((v / sum) * 100)),
    fill: donutColor(name),
  }));
}

/** @param {Record<string, any>|undefined|null} agents */
export function hasUsableAgentScores(agents) {
  if (!agents || typeof agents !== "object") return false;
  return AGENT_ORDER.some(({ key }) => pctFromAgent(agents[key]) != null);
}
