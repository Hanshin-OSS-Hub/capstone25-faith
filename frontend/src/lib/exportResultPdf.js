/**
 * FAITH 검증 결과 — 데이터 기반 PDF (jsPDF, A4, 한글 TTF; AI 요약 시 2페이지)
 */
import { GState, jsPDF } from "jspdf";
import { buildFaithVerdictHeadline, formatVerdictDetectionLabel } from "./faithVerdictTitle";
import { maskAuthorDisplay } from "./maskAuthor";
import {
  AGENT_ORDER,
  buildAgentScoreRows,
  buildDonutSlices,
  hasUsableAgentScores,
} from "./resultAgentSummary.js";

/** 동일 출처 우선(배포·방화벽에서 GitHub raw 차단 대비), 실패 시 CDN */
const NANUM_GOTHIC_TTF_FALLBACK =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Regular.ttf";
const NANUM_MIN_BYTES = 80_000;

/** A4 세로 (mm) */
const PAGE_W = 210;
const PAGE_H = 297;
/** 본문·헤더 좌우 여백 — 좁힐수록 제목·판독 근거 가로 확보 */
const M = 12;
const HEADER_H = 42;
/** 헤더 다크 바 아래 ~본문 카드까지 세로 여백(mm) */
const HEADER_BODY_GAP = 5;
const FOOTER_H = 13;
const COL_GAP = 5;
/** 좌(게이지·검증 대상) — 우측 【검증】 제목 한 줄 폭 우선 */
const COL_L_W = 47;
const MAIN_Y = HEADER_H + HEADER_BODY_GAP;
const MAIN_H = PAGE_H - MAIN_Y - FOOTER_H;

/** PDF 강조색(주황 대신 블루 계열) — #2563eb / #1d4ed8 등 */
const BLUE = { r: 37, g: 99, b: 235 };
const BLUE_DK = { r: 29, g: 78, b: 216 };
const BLUE_SOFT_BG = { r: 239, g: 246, b: 255 };
const BLUE_SOFT_BD = { r: 147, g: 197, b: 253 };
const BLUE_INK = { r: 30, g: 58, b: 138 };
const BLUE_INK_MUTED = { r: 30, g: 64, b: 175 };

/** jsPDF Unicode 폰트에서 기본 문자 간격이 벌어지는 경우 방지 */
const TX = { charSpace: 0 };

/**
 * 홈페이지 `RiskChart.jsx` getColor와 동일: score 0~1 구간 → Low/Moderate/High/Critical 색
 * @param {number} score100 0~100
 * @returns {{ hex: string, r: number, g: number, b: number }}
 */
function riskAccentFromScore100(score100) {
  const s = Math.max(0, Math.min(100, Number(score100) || 0)) / 100;
  if (s <= 0.33) return { hex: "#10b981", r: 16, g: 185, b: 129 };
  if (s <= 0.5) return { hex: "#f59e0b", r: 245, g: 158, b: 11 };
  if (s <= 0.66) return { hex: "#f97316", r: 249, g: 115, b: 22 };
  return { hex: "#ef4444", r: 239, g: 68, b: 68 };
}

/** PDF 테두리용 — RGB를 한 단계 어둡게 */
function riskAccentDarker(ac) {
  return {
    r: Math.max(0, Math.min(255, Math.floor(ac.r * 0.72))),
    g: Math.max(0, Math.min(255, Math.floor(ac.g * 0.72))),
    b: Math.max(0, Math.min(255, Math.floor(ac.b * 0.72))),
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return btoa(binary);
}

/** TTF 바이너리 base64 — 네트워크 1회만; jsPDF는 문서마다 VFS에 다시 넣어야 함 */
let nanumGothicB64Cache = null;

function nanumFontCandidates() {
  const urls = [];
  if (typeof window !== "undefined") {
    const base = import.meta.env.BASE_URL || "/";
    const path = `${base.endsWith("/") ? base : `${base}/`}fonts/NanumGothic-Regular.ttf`;
    urls.push(new URL(path.replace(/\/{2,}/g, "/"), window.location.origin).href);
  }
  urls.push(NANUM_GOTHIC_TTF_FALLBACK);
  return urls;
}

async function loadNanumGothicBase64() {
  let lastErr = null;
  for (const url of nanumFontCandidates()) {
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength < NANUM_MIN_BYTES) {
        lastErr = new Error(`폰트 용량 비정상(${buf.byteLength})`);
        continue;
      }
      return arrayBufferToBase64(buf);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(
    `한글 폰트(NanumGothic)를 불러오지 못했습니다. ${lastErr?.message ?? ""}\n` +
      "public/fonts/NanumGothic-Regular.ttf 배포 여부·네트워크를 확인해 주세요.",
  );
}

/**
 * @param {import("jspdf").jsPDF} doc
 */
async function ensureNanumFont(doc) {
  if (nanumGothicB64Cache == null) {
    nanumGothicB64Cache = await loadNanumGothicBase64();
  }
  doc.addFileToVFS("NanumGothic-Regular.ttf", nanumGothicB64Cache);
  doc.addFont("NanumGothic-Regular.ttf", "NanumGothic", "normal");
  doc.setFont("NanumGothic", "normal");
  doc.setCharSpace(0);
}

/**
 * @param {string|null|undefined} url
 * @returns {Promise<string|null>}
 */
async function loadImageDataUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;
  const abs = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : new URL(trimmed, window.location.origin).href;
  const res = await fetch(abs, { credentials: "include", mode: "cors" });
  if (!res.ok) throw new Error(`이미지 로드 실패 ${res.status}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("이미지 읽기 실패"));
    fr.readAsDataURL(blob);
  });
}

/**
 * 원호만: 회색 트랙 + RiskChart 구간색 arc, 중앙 숫자·% (라벨/뱃지는 PDF에서 그림)
 * PDF에 ~46mm 삽입 시 선명하도록 고해상도(레티나급)로 렌더.
 * @param {number} score100
 */
function renderGaugeArcPng(score100) {
  const size = 720;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  const lw = size * 0.085;
  const score = Math.max(0, Math.min(100, Number(score100) || 0));
  const frac = score / 100;
  const ac = riskAccentFromScore100(score100);

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * frac);
  ctx.strokeStyle = ac.hex;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.stroke();

  const n = String(Math.round(score));
  const fontN = `700 ${Math.floor(size * 0.19)}px system-ui,Segoe UI,sans-serif`;
  const fontP = `600 ${Math.floor(size * 0.1)}px system-ui,Segoe UI,sans-serif`;
  const gapPx = Math.max(2, Math.floor(size * 0.012));
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = fontN;
  const wN = ctx.measureText(n).width;
  ctx.font = fontP;
  const wP = ctx.measureText("%").width;
  let tx = cx - (wN + gapPx + wP) / 2;
  ctx.fillStyle = ac.hex;
  ctx.font = fontN;
  ctx.fillText(n, tx, cy);
  tx += wN + gapPx;
  ctx.font = fontP;
  ctx.fillText("%", tx, cy);

  return canvas.toDataURL("image/png");
}

/** PDF 도넛 — `resultAgentSummary.buildDonutSlices`의 fill과 동일(웹·PDF 색 일치) */
function pdfSlicesWithPalette(agents, finalCategory) {
  return buildDonutSlices(agents || {}, finalCategory);
}

function hexToRgbForPdf(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
  if (!m) return { r: 100, g: 116, b: 139 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function enRiskBadge(level) {
  const L = String(level || "").toUpperCase();
  if (L === "LOW") return "LOW RISK";
  if (L === "MEDIUM" || L === "MODERATE") return "MEDIUM RISK";
  if (L === "HIGH") return "HIGH RISK";
  if (L === "CRITICAL") return "CRITICAL RISK";
  return "RISK";
}

function policeRisk(level) {
  const L = String(level || "").toUpperCase();
  return L === "HIGH" || L === "CRITICAL";
}

function buildDocId(data) {
  if (data.archiveItemId != null) {
    const n = String(data.archiveItemId);
    return `CVR-${n.padStart(6, "0")}`;
  }
  const t = Date.now().toString(36).toUpperCase().slice(-8);
  return `CVR-${t}`;
}

/**
 * mm 단위 maxWidth로 줄 배열 반환. jsPDF getTextWidth(한글)=0 문제를 피하기 위해 Canvas measureText 사용.
 * @param {string|null|undefined} text
 * @param {number} fontSizePt
 * @param {number} maxWidthMm
 * @returns {string[]}
 */
function normalizeSpaces(s) {
  return String(s || "")
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapKoreanText(text, fontSizePt, maxWidthMm) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [normalizeSpaces(text) || "—"];
  // 1pt ≈ 1.333px, 1mm ≈ 3.7795px — PDF에 넣는 pt와 동일 기준
  const pxPerMm = 3.7795;
  const fontSizePx = fontSizePt * 1.333;
  ctx.font = `normal ${fontSizePx}px "Nanum Gothic","NanumGothic","Malgun Gothic","Apple SD Gothic Neo",sans-serif`;
  const maxWidthPx = maxWidthMm * pxPerMm;

  const lines = [];
  let current = "";
  for (const ch of normalizeSpaces(text)) {
    if (ch === "\n" || ch === "\r") {
      if (current.length > 0) lines.push(current);
      current = "";
      continue;
    }
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidthPx && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/**
 * object-fit: contain — 박스 안에 전체 이미지가 들어가도록 비율 유지(가로·세로 잘림 없음)
 * @param {string} dataUrl
 * @param {number} boxWmm
 * @param {number} boxHmm
 */
async function fitDataUrlToContainPng(dataUrl, boxWmm, boxHmm) {
  const pxPerMm = 6;
  const tw = Math.max(32, Math.round(boxWmm * pxPerMm));
  const th = Math.max(32, Math.round(boxHmm * pxPerMm));
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    img.onload = () => resolve(null);
    img.onerror = () => reject(new Error("이미지 표시 실패"));
    img.src = dataUrl;
  });
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return dataUrl;
  const scale = Math.min(tw / iw, th / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (tw - dw) / 2;
  const dy = (th - dh) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
  return canvas.toDataURL("image/png");
}

/**
 * @param {import("jspdf").jsPDF} pdf
 * @param {string[]} lines
 * @param {number} maxLines
 */
function clipLines(lines, maxLines) {
  if (lines.length <= maxLines) return lines;
  const out = lines.slice(0, maxLines);
  let last = out[maxLines - 1] || "";
  if (last.length > 1) {
    last = `${last.slice(0, Math.max(0, last.length - 2))}…`;
  } else {
    last = "…";
  }
  out[maxLines - 1] = last;
  return out;
}

/** 세로 바 — 웹 에이전트 시각화와 동일 계열 */
const VBAR_W_MM = 14;
const VBAR_GAP_MM = 8;
const VBAR_MAX_H_MM = 30;
/** 웹 `rounded-lg`에 맞춤 — 막대 폭 대비 상한으로 캡슐형 왜곡 방지 */
const VBAR_RX_MM = 1.25;
const VBAR_RX_MAX_FRAC_OF_W = 0.14;
const VBAR_SCORE_AREA_H_MM = 5.5;
const VBAR_LABEL_GAP_MM = 2;
const VBAR_MODEL_LABEL_H_MM = 4;
const VBAR_LEG_GAP_MM = 2;
/** 트랙·모델명 블록 아래 ~범례 텍스트 베이스까지 */
const VBAR_LEGEND_BASELINE_PAD_MM = 3.2;
const VBAR_LEGEND_H_MM = 6;
const AI_CARD_PAD_MM = 4;
const AI_TITLE_STRIP_H_MM = 9;
/** 웹 ResultView 좌·우 카드 소제목+2줄 안내 높이(mm) */
const AI_AGENT_PANEL_SUBHEAD_MM = 11;
const AI_CATEGORY_PANEL_SUBHEAD_MM = 10;
const AI_BLUE_ACCENT_MM = 0.85; // ≈3px
const AI_DONUT_R_IN_MM = 14;
const AI_DONUT_RING_MM = 6;
const AI_DONUT_R_OUT_MM = AI_DONUT_R_IN_MM + AI_DONUT_RING_MM;
const AI_LEGEND_SQUARE_MM = 3;
const AI_LEGEND_LINE_GAP_MM = 6;

/** 웹 AgentScoreBarChart와 동일: 에이전트별 고정색(Tailwind 600 계열) */
function agentBarRgb(agentKey) {
  switch (agentKey) {
    case "gemini":
      return hexToRgbForPdf("#2563eb");
    case "groq":
      return hexToRgbForPdf("#7c3aed");
    case "hf":
      return hexToRgbForPdf("#0d9488");
    default:
      return hexToRgbForPdf("#64748b");
  }
}

/**
 * @param {number} [scale] — 2페이지 compact 시 &lt; 1
 */
function verticalBarsClusterWidthMm(scale = 1) {
  const w = VBAR_W_MM * scale;
  const g = VBAR_GAP_MM * scale;
  return AGENT_ORDER.length * w + (AGENT_ORDER.length - 1) * g;
}

/** 트랙 아래(모델명) — 제외 열은 상단에만 "분석 제외" 표시 */
function belowTrackHeightMm(pct) {
  void pct;
  return VBAR_LABEL_GAP_MM + VBAR_MODEL_LABEL_H_MM;
}

/**
 * @param {Record<string, any>|null|undefined} agents
 * @param {number} [scale]
 */
function verticalBarsContentHeightMm(agents, scale = 1) {
  let maxBelow = 0;
  for (const row of buildAgentScoreRows(agents || {})) {
    const pct =
      row.skipped || row.score == null ? null : row.score;
    maxBelow = Math.max(maxBelow, belowTrackHeightMm(pct));
  }
  const sh = VBAR_SCORE_AREA_H_MM * scale;
  const mh = VBAR_MAX_H_MM * scale;
  const legPad = VBAR_LEGEND_BASELINE_PAD_MM * scale;
  const legH = VBAR_LEGEND_H_MM * scale;
  return (
    sh +
    mh +
    maxBelow +
    VBAR_LEG_GAP_MM +
    legPad +
    legH
  );
}

/**
 * jsPDF context2d.arc — PDF 벡터 도넛(띠 그리기)
 * @param {import("jspdf").jsPDF} doc
 * @param {number} cxMm
 * @param {number} cyMm
 * @param {{ name: string, value: number, fill: string }[]} slices
 */
function drawPdfDonutWithArcs(doc, cxMm, cyMm, rOutMm, rInMm, slices) {
  if (!slices?.length) return;
  const ctx = doc.context2d;
  ctx.autoPaging = false;
  ctx.pageWrapYEnabled = false;
  if (slices.length === 1) {
    const sl = slices[0];
    ctx.fillStyle = sl.fill;
    ctx.beginPath();
    ctx.arc(cxMm, cyMm, rOutMm, 0, 2 * Math.PI, false);
    ctx.arc(cxMm, cyMm, rInMm, 2 * Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    doc.setFont("NanumGothic", "normal");
    return;
  }
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const padRad = (2 * Math.PI) / 180;
  const avail = 2 * Math.PI - slices.length * padRad;
  let ang = -Math.PI / 2;
  for (const sl of slices) {
    const sweep = Math.max(0.02, (sl.value / total) * avail);
    ctx.fillStyle = sl.fill;
    ctx.beginPath();
    ctx.arc(cxMm, cyMm, rOutMm, ang, ang + sweep, false);
    ctx.arc(cxMm, cyMm, rInMm, ang + sweep, ang, true);
    ctx.closePath();
    ctx.fill();
    ang += sweep + padRad;
  }
  doc.setFont("NanumGothic", "normal");
}

/** 웹 AgentScoreBarChart 좌측 소제목·안내 */
function drawPdfAiAgentLeftSubhead(doc, x0, colW, y0, compact) {
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(compact ? 8.5 : 9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("AI 에이전트별 점수", x0 + 0.5, y0 + 4, TX);
  doc.setFontSize(compact ? 6 : 6.5);
  doc.setTextColor(100, 116, 139);
  const hint =
    "각 모델이 산출한 위험도(0~100%)입니다. 막대 색은 모델만 구분하는 용도이며, 오른쪽 카테고리 도넛 색과는 무관합니다.";
  const lines = clipLines(
    wrapKoreanText(hint, compact ? 6 : 6.5, Math.max(24, colW - 1)),
    compact ? 2 : 3,
  );
  let y = y0 + 6.5;
  const step = compact ? 2.85 : 3.05;
  for (const ln of lines) {
    doc.text(ln, x0 + 0.5, y, TX);
    y += step;
  }
}

/** 웹 AgentCategoryDonut 우측 소제목·안내 */
function drawPdfAiCategoryRightSubhead(doc, x0, colW, y0, compact) {
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(compact ? 8.5 : 9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("카테고리 분포", x0 + 0.5, y0 + 4, TX);
  doc.setFontSize(compact ? 6 : 6.5);
  doc.setTextColor(100, 116, 139);
  const hint =
    "각 모델이 붙인 라벨에 위험도를 가중해 합친 비율입니다. 왼쪽 막대와 색·수치는 대응하지 않습니다.";
  const lines = clipLines(
    wrapKoreanText(hint, compact ? 6 : 6.5, Math.max(24, colW - 1)),
    compact ? 2 : 3,
  );
  let y = y0 + 6.5;
  const step = compact ? 2.85 : 3.05;
  for (const ln of lines) {
    doc.text(ln, x0 + 0.5, y, TX);
    y += step;
  }
}

/**
 * 모델별 세로 바(Gemini·Groq·HuggingFace) + 하단 범례 한 줄
 * @param {import("jspdf").jsPDF} doc
 * @param {number} x0
 * @param {number} y0
 * @param {number} colW
 * @param {Record<string, any>|null|undefined} agents
 * @param {number} [scale] — compact(2페이지) 시 0.88 등
 * @returns {number} 사용 높이(mm)
 */
function drawPdfVerticalAgentBars(doc, x0, y0, colW, agents, scale = 1) {
  const trackRgb = hexToRgbForPdf("#f1f5f9");
  const skipTrackRgb = hexToRgbForPdf("#cbd5e1");
  const bw = VBAR_W_MM * scale;
  const bgap = VBAR_GAP_MM * scale;
  const mh = VBAR_MAX_H_MM * scale;
  const rx = Math.min(
    Math.max(0.45, VBAR_RX_MM * scale),
    bw * VBAR_RX_MAX_FRAC_OF_W,
  );
  const scoreH = VBAR_SCORE_AREA_H_MM * scale;
  const clusterW = verticalBarsClusterWidthMm(scale);
  const xStart = x0 + Math.max(0, (colW - clusterW) / 2);
  const yTrackTop = y0 + scoreH;
  const yTrackBottom = yTrackTop + mh;

  const scoreRows = buildAgentScoreRows(agents || {});
  scoreRows.forEach((row, i) => {
    const x = xStart + i * (bw + bgap);
    const pct = row.skipped || row.score == null ? null : row.score;
    const xc = x + bw / 2;
    const { key, label } = row;

    if (pct == null) {
      doc.setFillColor(skipTrackRgb.r, skipTrackRgb.g, skipTrackRgb.b);
      doc.roundedRect(x, yTrackTop, bw, mh, rx, rx, "F");
      doc.setFont("NanumGothic", "normal");
      doc.setFontSize(Math.max(7, 9 * scale));
      doc.setTextColor(100, 116, 139);
      doc.text("분석 제외", xc, y0 + 3.2 * scale + 1.2, { align: "center", ...TX });
    } else {
      doc.setFillColor(trackRgb.r, trackRgb.g, trackRgb.b);
      doc.roundedRect(x, yTrackTop, bw, mh, rx, rx, "F");
      const h = Math.max(
        0.35 * scale,
        (Math.max(0, Math.min(100, pct)) / 100) * mh,
      );
      const yFill = yTrackBottom - h;
      const rgb = agentBarRgb(key);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.roundedRect(x, yFill, bw, h, rx, rx, "F");
      doc.setFont("NanumGothic", "normal");
      doc.setFontSize(Math.max(7, 9 * scale));
      doc.setTextColor(15, 23, 42);
      doc.text(`${pct}%`, xc, y0 + 3.2 * scale + 1.2, { align: "center", ...TX });
    }

    let yBelow = yTrackBottom + VBAR_LABEL_GAP_MM;
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(Math.max(7.5, 9 * scale));
    doc.setTextColor(100, 116, 139);
    doc.text(label, xc, yBelow + 3.2 * scale, { align: "center", ...TX });
    yBelow += VBAR_MODEL_LABEL_H_MM * scale;
  });

  const legendBaselineY =
    yTrackBottom +
    Math.max(
      ...buildAgentScoreRows(agents || {}).map((row) =>
        belowTrackHeightMm(
          row.skipped || row.score == null ? null : row.score,
        ),
      ),
    ) +
    VBAR_LEG_GAP_MM +
    VBAR_LEGEND_BASELINE_PAD_MM * scale;
  const legGray = { r: 100, g: 116, b: 139 };
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(Math.max(7, 8 * scale));
  doc.setTextColor(legGray.r, legGray.g, legGray.b);
  const dotR = 0.9 * scale;
  const items = [
    { label: "Gemini", rgb: hexToRgbForPdf("#2563eb") },
    { label: "Groq", rgb: hexToRgbForPdf("#7c3aed") },
    { label: "HuggingFace", rgb: hexToRgbForPdf("#0d9488") },
    { label: "분석 제외", rgb: hexToRgbForPdf("#cbd5e1") },
  ];
  let lx = x0 + 1;
  for (const it of items) {
    doc.setFillColor(it.rgb.r, it.rgb.g, it.rgb.b);
    doc.circle(lx + dotR, legendBaselineY - 0.65, dotR, "F");
    doc.text(it.label, lx + dotR * 2 + 1.4, legendBaselineY, TX);
    lx += dotR * 2 + 1.4 + doc.getTextWidth(it.label) + 3.5;
  }

  return verticalBarsContentHeightMm(agents, scale);
}

/**
 * @param {number} cardW
 * @param {Record<string, any>|null|undefined} [agents] — 없으면 최대 높이(생략 열 가정)
 * @param {number} [barScale]
 * @param {number} [donutShrink] — 2페이지 전체 도넛 추가 축소
 */
function computeAiAnalysisCardHeightMm(
  cardW,
  agents,
  barScale = 1,
  donutShrink = 1,
) {
  const pad = AI_CARD_PAD_MM;
  const innerW = cardW - 2 * pad;
  const leftColW = Math.max(
    verticalBarsClusterWidthMm(barScale) + 4,
    Math.min(82, innerW * 0.44),
  );
  const midGap = 5;
  const rightColW = innerW - leftColW - midGap;
  const donutD = AI_DONUT_R_OUT_MM * 2 * donutShrink;
  const legendNeedW = (AI_LEGEND_SQUARE_MM + 2 + 42) * donutShrink;
  const scaleDonut =
    rightColW < legendNeedW + donutD
      ? Math.max(0.72, (rightColW - legendNeedW) / donutD)
      : 1;
  const rOut = AI_DONUT_R_OUT_MM * scaleDonut * donutShrink;
  const worstAgents =
    agents ||
    Object.fromEntries(AGENT_ORDER.map(({ key }) => [key, { skipped: true }]));
  const barsH = verticalBarsContentHeightMm(worstAgents, barScale);
  const titleH = AI_TITLE_STRIP_H_MM;
  const leftBodyH = AI_AGENT_PANEL_SUBHEAD_MM + barsH;
  const rightBodyH = AI_CATEGORY_PANEL_SUBHEAD_MM + rOut * 2 + 2;
  const bodyH = Math.max(leftBodyH, rightBodyH);
  return pad * 2 + titleH + 3 + bodyH + 2;
}

/**
 * AI 분석 시각화 카드(1페이지 하단 또는 2페이지 전용)
 * @param {{ compact?: boolean }} [opts] — compact: 2페이지용 축소 레이아웃
 * @returns {number} 카드 높이(mm)
 */
function drawAiAnalysisCardOnPage1(
  doc,
  cardX,
  cardY,
  cardW,
  agents,
  finalCategory,
  opts = {},
) {
  const barScale = opts.compact ? 0.88 : 1;
  const donutShrink = opts.compact ? 0.9 : 1;
  const slices = pdfSlicesWithPalette(agents, finalCategory);
  const pad = AI_CARD_PAD_MM;
  const innerW = cardW - 2 * pad;
  const leftColW = Math.max(
    verticalBarsClusterWidthMm(barScale) + 4,
    Math.min(82, innerW * 0.44),
  );
  const midGap = 5;
  const rightColW = innerW - leftColW - midGap;
  const donutD = AI_DONUT_R_OUT_MM * 2 * donutShrink;
  const legendNeedW = (AI_LEGEND_SQUARE_MM + 2 + 42) * donutShrink;
  const scaleDonut =
    rightColW < legendNeedW + donutD
      ? Math.max(0.72, (rightColW - legendNeedW) / donutD)
      : 1;
  const rOut = AI_DONUT_R_OUT_MM * scaleDonut * donutShrink;
  const rIn = AI_DONUT_R_IN_MM * scaleDonut * donutShrink;

  const titleH = AI_TITLE_STRIP_H_MM;
  const barsH = verticalBarsContentHeightMm(agents, barScale);
  const bodyH = Math.max(
    AI_AGENT_PANEL_SUBHEAD_MM + barsH,
    AI_CATEGORY_PANEL_SUBHEAD_MM + rOut * 2 + 2,
  );
  const cardH = computeAiAnalysisCardHeightMm(
    cardW,
    agents,
    barScale,
    donutShrink,
  );

  doc.setFillColor(248, 249, 255);
  doc.setDrawColor(210, 218, 237);
  doc.setLineWidth(0.35);
  doc.roundedRect(cardX, cardY, cardW, cardH, 2.5, 2.5, "FD");

  const accentRgb = hexToRgbForPdf("#4361ee");
  doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
  doc.rect(cardX + pad, cardY + pad + 1.5, AI_BLUE_ACCENT_MM, titleH - 1, "F");

  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(opts.compact ? 10 : 11);
  doc.setTextColor(30, 41, 59);
  doc.text("AI 분석 시각화", cardX + pad + AI_BLUE_ACCENT_MM + 2, cardY + pad + 6.5, TX);

  const bodyTop = cardY + pad + titleH + 3;
  const leftX = cardX + pad;
  drawPdfAiAgentLeftSubhead(doc, leftX, leftColW, bodyTop, opts.compact);
  drawPdfVerticalAgentBars(
    doc,
    leftX,
    bodyTop + AI_AGENT_PANEL_SUBHEAD_MM,
    leftColW,
    agents,
    barScale,
  );

  const rightX = leftX + leftColW + midGap;
  drawPdfAiCategoryRightSubhead(doc, rightX, rightColW, bodyTop, opts.compact);

  const cx = rightX + rOut + 1;
  const cy = bodyTop + AI_CATEGORY_PANEL_SUBHEAD_MM + (bodyH - AI_CATEGORY_PANEL_SUBHEAD_MM) / 2;
  drawPdfDonutWithArcs(doc, cx, cy, rOut, rIn, slices);

  const topSlice = slices.reduce(
    (a, b) => (b.value > a.value ? b : a),
    slices[0],
  );
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(opts.compact ? 6 : 6.5);
  doc.setTextColor(71, 85, 105);
  const centerLines = clipLines(
    wrapKoreanText(topSlice.name, opts.compact ? 6 : 6.5, rIn * 1.7),
    2,
  );
  let cyy = cy - (centerLines.length * 2.2) / 2 + 1;
  for (const ln of centerLines) {
    doc.text(ln, cx, cyy, { align: "center", ...TX });
    cyy += 2.2;
  }

  const legSq = AI_LEGEND_SQUARE_MM * (opts.compact ? 0.9 : 1);
  const legLineGap = AI_LEGEND_LINE_GAP_MM * (opts.compact ? 0.92 : 1);
  const legX = rightX + rOut * 2 + midGap + 1;
  let legY = bodyTop + AI_CATEGORY_PANEL_SUBHEAD_MM + 3;
  const legMaxY = cardY + cardH - pad - 1;
  doc.setFontSize(opts.compact ? 7.5 : 8);
  for (const sl of slices) {
    if (legY > legMaxY) break;
    const { r, g, b } = hexToRgbForPdf(sl.fill);
    doc.setFillColor(r, g, b);
    doc.rect(legX, legY - legSq + 1, legSq, legSq, "F");
    doc.setTextColor(30, 41, 59);
    doc.text(`${sl.name}  ${sl.value}%`, legX + legSq + 2.2, legY + 0.5, TX);
    legY += legLineGap;
  }

  return cardH;
}

export function parseReportSections(reportText) {
  const out = {
    category: "",
    core: "",
    reason: "",
    recommend: "",
  };
  const raw = String(reportText || "").trim();
  if (!raw) return out;
  const blocks = raw.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  for (const block of blocks) {
    if (block.startsWith("카테고리:")) {
      out.category = block.replace(/^카테고리:\s*/i, "").trim();
    } else if (block.startsWith("핵심 판단:")) {
      out.core = block.replace(/^핵심 판단:\s*/i, "").trim();
    } else if (block.startsWith("근거:")) {
      out.reason = block.replace(/^근거:\s*/i, "").trim();
    } else if (/^권장/.test(block)) {
      out.recommend = block.replace(/^권장:?\s*/i, "").trim();
    }
  }
  return out;
}

/**
 * @typedef {object} FaithPdfExportData
 * @property {string} headline
 * @property {string|null} author
 * @property {number} score
 * @property {string} level
 * @property {string} reportText
 * @property {string} confidenceText — CONFIDENCE 칸 표시(예: "72%")
 * @property {string|null|undefined} confidenceTooltip — 통합 지수와의 구분 안내(PDF 소문구)
 * @property {string} detectionLabel
 * @property {string|null} previewImage
 * @property {string|null|undefined} previewText — 검증에 사용한 텍스트 본문(PDF 좌측; 이미지와 동시에 있으면 하단 영역에 함께 표시)
 * @property {Record<string, any>|null|undefined} agents — AI별 점수·분포 (있으면 2페이지)
 * @property {string|null|undefined} finalCategory — 통합 카테고리(도넛 폴백용)
 * @property {boolean} isArchive
 * @property {number|null} archiveItemId
 */

/**
 * 검증 결과 데이터로 A4 PDF를 생성해 저장합니다(에이전트 점수가 있으면 2페이지).
 * @param {FaithPdfExportData} data
 * @param {string} filename
 */
export async function exportResultToPdfDirect(data, filename) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  await ensureNanumFont(doc);

  const colRX = M + COL_L_W + COL_GAP;
  const colRW = PAGE_W - M * 2 - COL_L_W - COL_GAP;
  const scoreN = Math.round(Math.max(0, Math.min(100, Number(data.score) || 0)));
  /** RiskChart.jsx와 동일 구간색 — 게이지·RISK INDEX 배지 공통 */
  const riskPalette = riskAccentFromScore100(data.score);
  const riskPaletteStroke = riskAccentDarker(riskPalette);
  const levelStr = String(data.level || "").toUpperCase();
  const showWarn = policeRisk(data.level);
  const docId = buildDocId(data);
  const GAP = 2;
  const footerTop = PAGE_H - FOOTER_H;
  const confidenceTooltip = String(data.confidenceTooltip || "").trim();
  const METRICS_H = confidenceTooltip ? 32 : 26;
  const hasAgents = hasUsableAgentScores(data.agents);
  const aiCardWFull = PAGE_W - 2 * M;
  /** 판독 근거 카드가 침범하지 않는 상한(메트릭+푸터) — AI는 2페이지 */
  const evidenceBottom = footerTop - METRICS_H - GAP - 1;

  /* ----- 1. 헤더 42mm ----- */
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  const headLeftW = 118;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(147, 197, 253);
  doc.text("Content Verification Report", M, 9, TX);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  const headLines = clipLines(
    wrapKoreanText(data.headline || "FAITH 검증 결과", 16, headLeftW - 2),
    2,
  );
  let hy = 15;
  for (const ln of headLines) {
    doc.text(ln, M, hy, TX);
    hy += 6.2;
  }

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setGState(new GState({ opacity: 0.72 }));
  if (data.isArchive) {
    doc.text("아카이브에 저장된 검증 결과입니다.", M, Math.max(hy + 2, 30), TX);
  }
  doc.setGState(new GState({ opacity: 1 }));

  const rightX = PAGE_W - M;
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setGState(new GState({ opacity: 0.75 }));
  doc.text(`DOC ID: ${docId}`, rightX, 10, { align: "right", ...TX });
  doc.setGState(new GState({ opacity: 1 }));
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const authorLine = `작성자: ${maskAuthorDisplay(data.author)}`;
  doc.text(authorLine, rightX, 20, { align: "right", ...TX });

  /* ----- 좌열: 리스크 카드는 게이지+배지만큼만, 남는 세로는 이미지에 ----- */
  const RISK_GAP = 3;
  const IMG_CARD_CAPTION = 9 + 5;
  /** 좌열 폭에 맞춘 게이지 삽입 크기(mm) */
  const gMm = Math.min(44, COL_L_W - 2);
  const riskGaugeTopMm = 10;
  const gapGaugeToBadgeMm = 3.5;
  const badgeH = 7;
  const riskBottomPadMm = 4;
  /** RISK INDEX 라벨(~7mm) + 게이지 + 배지 + 여백 — 불필요한 세로 빈칸 제거 */
  const RISK_CARD_H =
    riskGaugeTopMm + gMm + gapGaugeToBadgeMm + badgeH + riskBottomPadMm;
  const imgSlotH = MAIN_H - RISK_GAP - RISK_CARD_H;
  /** 가로 폭은 열 너비 고정, 세로만 과도하게 늘리지 않음(최대 55mm) */
  const IMG_AREA_H = Math.min(55, Math.max(36, imgSlotH - IMG_CARD_CAPTION));
  const IMG_CARD_H = IMG_CARD_CAPTION + IMG_AREA_H;

  const VERDICT_H = 36;
  const WARN_H = showWarn ? 28 : 0;
  const evidenceTop = MAIN_Y + VERDICT_H + GAP + WARN_H + GAP;
  const EVIDENCE_MAX = Math.max(52, evidenceBottom - evidenceTop);

  const lx = M;
  const ly = MAIN_Y;

  /* ----- 좌: 리스크 카드 ----- */
  doc.setFillColor(248, 249, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(lx, ly, COL_L_W, RISK_CARD_H, 2.5, 2.5, "FD");
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("RISK INDEX", lx + COL_L_W / 2, ly + 6, {
    align: "center",
    ...TX,
  });

  const gaugePng = renderGaugeArcPng(data.score);
  const gx = lx + (COL_L_W - gMm) / 2;
  const gy = ly + riskGaugeTopMm;
  if (gaugePng) {
    doc.addImage(gaugePng, "PNG", gx, gy, gMm, gMm, undefined, "SLOW");
  }

  const badge = enRiskBadge(data.level);
  doc.setFontSize(7.5);
  doc.setTextColor(riskPalette.r, riskPalette.g, riskPalette.b);
  const bw = doc.getTextWidth(badge) + 6;
  const bx = lx + (COL_L_W - bw) / 2;
  const by = ly + riskGaugeTopMm + gMm + gapGaugeToBadgeMm;
  doc.setDrawColor(
    riskPaletteStroke.r,
    riskPaletteStroke.g,
    riskPaletteStroke.b,
  );
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(bx, by, bw, 7, 1.5, 1.5, "FD");
  doc.text(badge, bx + bw / 2, by + 5.2, { align: "center", ...TX });

  /* ----- 좌: 이미지 카드 ----- */
  const imgY = ly + RISK_CARD_H + RISK_GAP;
  doc.setFillColor(248, 249, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(lx, imgY, COL_L_W, IMG_CARD_H, 2.5, 2.5, "FD");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const previewTextRaw = normalizeSpaces(data.previewText);
  const hasImgUrl = Boolean(
    data.previewImage && String(data.previewImage).trim(),
  );
  const hasBothPreview = Boolean(hasImgUrl && previewTextRaw);
  const capLabel = hasBothPreview
    ? "검증 대상 (이미지·텍스트)"
    : hasImgUrl
      ? "검증 대상 이미지"
      : previewTextRaw
        ? "검증 대상 (텍스트)"
        : "검증 대상";
  doc.text(capLabel, lx + 4, imgY + 6, TX);

  const innerImgX = lx + 3;
  const innerImgY = imgY + 9;
  const innerImgW = COL_L_W - 6;
  const innerImgH = IMG_AREA_H;
  /** 이미지·텍스트 동시: 세로를 나눠 둘 다 표시 */
  const BOTH_GAP_MM = 2;
  let imageRegionH = innerImgH;
  let textRegionY = innerImgY;
  let textRegionH = innerImgH;
  if (hasBothPreview) {
    imageRegionH = Math.min(38, Math.max(22, Math.floor(innerImgH * 0.52)));
    textRegionH = innerImgH - BOTH_GAP_MM - imageRegionH;
    if (textRegionH < 14) {
      textRegionH = 14;
      imageRegionH = Math.max(18, innerImgH - BOTH_GAP_MM - textRegionH);
    }
    textRegionY = innerImgY + imageRegionH + BOTH_GAP_MM;
  }

  let drewImage = false;
  if (data.previewImage) {
    try {
      const durl = await loadImageDataUrl(data.previewImage);
      const fitted = await fitDataUrlToContainPng(
        durl,
        innerImgW,
        imageRegionH,
      );
      doc.addImage(
        fitted,
        "PNG",
        innerImgX,
        innerImgY,
        innerImgW,
        imageRegionH,
        undefined,
        "FAST",
      );
      drewImage = true;
    } catch {
      drewImage = false;
    }
  }

  let drewText = false;
  if (previewTextRaw) {
    const textBoxY = hasBothPreview ? textRegionY : innerImgY;
    const textBoxH = hasBothPreview ? textRegionH : innerImgH;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(innerImgX, textBoxY, innerImgW, textBoxH, 2, 2, "FD");
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(hasBothPreview ? 7 : 8);
    doc.setTextColor(30, 41, 59);
    const lineStep = hasBothPreview ? 3.35 : 3.85;
    const maxLines = Math.max(2, Math.floor((textBoxH - 6) / lineStep));
    const textLines = clipLines(
      wrapKoreanText(
        previewTextRaw,
        hasBothPreview ? 7 : 8,
        innerImgW - 6,
      ),
      maxLines,
    );
    let tyy = textBoxY + 4;
    for (const tl of textLines) {
      doc.text(tl, innerImgX + 3, tyy, TX);
      tyy += lineStep;
    }
    drewText = true;
  }

  const drewSubject = drewImage || drewText;
  if (!drewSubject) {
    doc.setFillColor(30, 41, 59);
    doc.setDrawColor(51, 65, 85);
    doc.roundedRect(innerImgX, innerImgY, innerImgW, innerImgH, 2, 2, "FD");
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "이미지 없음",
      innerImgX + innerImgW / 2,
      innerImgY + innerImgH / 2,
      { align: "center", baseline: "middle", ...TX },
    );
  }

  /* ----- 우: Verdict ----- */
  const rx = colRX;
  const ry = MAIN_Y;
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setDrawColor(BLUE_DK.r, BLUE_DK.g, BLUE_DK.b);
  doc.roundedRect(rx, ry, colRW, VERDICT_H, 2.5, 2.5, "F");

  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.setGState(new GState({ opacity: 0.92 }));
  const tag = formatVerdictDetectionLabel(data.detectionLabel);
  doc.text(tag, rx + 4, ry + 7, TX);
  doc.setGState(new GState({ opacity: 1 }));

  const verdictTitle = buildFaithVerdictHeadline(data.detectionLabel, scoreN);
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const vLines = clipLines(wrapKoreanText(verdictTitle, 11, colRW - 5), 2);
  let vy = ry + 14;
  for (const vl of vLines) {
    doc.text(vl, rx + 4, vy, TX);
    vy += 5.2;
  }

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setGState(new GState({ opacity: 0.88 }));
  const footVerdict = `작성자 ${maskAuthorDisplay(data.author)} · 리스크 수준: ${levelStr || "-"}`;
  doc.text(footVerdict, rx + 4, ry + VERDICT_H - 4, TX);
  doc.setGState(new GState({ opacity: 1 }));

  /* ----- 우: 경고 (HIGH/CRITICAL) ----- */
  let nextY = ry + VERDICT_H + GAP;
  if (showWarn) {
    doc.setFillColor(BLUE_SOFT_BG.r, BLUE_SOFT_BG.g, BLUE_SOFT_BG.b);
    doc.setDrawColor(BLUE_SOFT_BD.r, BLUE_SOFT_BD.g, BLUE_SOFT_BD.b);
    doc.roundedRect(rx, nextY, colRW, WARN_H, 2, 2, "FD");
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.rect(rx, nextY, 1.6, WARN_H, "F");

    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(BLUE_INK.r, BLUE_INK.g, BLUE_INK.b);
    doc.text(
      "위험도가 높습니다. 피해·범죄가 의심되면 경찰에 신고하세요.",
      rx + 5,
      nextY + 6,
      TX,
    );
    doc.setFontSize(7);
    doc.setTextColor(BLUE_INK_MUTED.r, BLUE_INK_MUTED.g, BLUE_INK_MUTED.b);
    const wBody = clipLines(
      wrapKoreanText(
        "본 문서는 참고용이며 법적 효력이 없습니다. 온라인 민원은 경찰청 포털을 이용하세요.",
        7,
        colRW - 14,
      ),
      2,
    );
    let wy = nextY + 11;
    for (const wl of wBody) {
      doc.text(wl, rx + 5, wy, TX);
      wy += 3.6;
    }

    const btnW = 32;
    const btnH = 8;
    const btnX = rx + 5;
    const btnY = nextY + WARN_H - btnH - 3;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(BLUE_DK.r, BLUE_DK.g, BLUE_DK.b);
    doc.roundedRect(btnX, btnY, btnW, btnH, 1.2, 1.2, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor(BLUE_DK.r, BLUE_DK.g, BLUE_DK.b);
    doc.text("긴급 신고 112", btnX + btnW / 2, btnY + 5.2, {
      align: "center",
      ...TX,
    });

    nextY += WARN_H + GAP;
  }

  /* ----- 우: 판독 근거 카드(높이 = 본문에 맞춤, 상한 EVIDENCE_MAX) ----- */
  const sec = parseReportSections(data.reportText);
  const ex = rx;
  const ey = nextY;

  const labelW = 20;
  const valPadL = 6.5;
  const valPadR = 4;
  const valX = ex + valPadL + labelW;
  /** 우측 컬럼에서 라벨·좌우 패딩을 뺀 값 텍스트 너비(mm) — 절대 좌표(valX)와 colRW를 섞지 않음 */
  const valWmm = colRW - valPadL - labelW - valPadR;
  const rowGap = 2;
  const evidenceTitleH = 14;
  const evidenceBottomPad = 4;
  const rowLabelBand = 4;
  const catLineCap = Math.max(1, Math.floor((showWarn ? 10 : 11) / 3.5));
  const coreLineCap = Math.max(1, Math.floor((showWarn ? 14 : 16) / 3.5));
  const recLineCap = Math.max(1, Math.floor((showWarn ? 10 : 11) / 3.5));

  const catLines = clipLines(
    wrapKoreanText(sec.category || "—", 8, valWmm),
    catLineCap,
  );
  const coreLines = clipLines(
    wrapKoreanText(sec.core || "—", 8, valWmm),
    coreLineCap,
  );
  const reasonLines = wrapKoreanText(sec.reason || "—", 8, valWmm).slice(0, 3);
  const recLines = clipLines(
    wrapKoreanText(sec.recommend || "—", 8, valWmm),
    recLineCap,
  );

  const catH = Math.max(8, rowLabelBand + catLines.length * 3.5 + 2);
  const coreH = Math.max(9, rowLabelBand + coreLines.length * 3.5 + 2);
  const reasonH = Math.max(12, 5 + reasonLines.length * 3.5 + 3);
  const recH = Math.max(8, rowLabelBand + recLines.length * 3.5 + 2);

  const evidenceBodyH =
    evidenceTitleH +
    catH +
    rowGap +
    coreH +
    rowGap +
    reasonH +
    rowGap +
    recH +
    evidenceBottomPad;
  const EVIDENCE_USED = Math.min(
    EVIDENCE_MAX,
    Math.max(42, evidenceBodyH),
  );

  doc.setFillColor(248, 249, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(ex, ey, colRW, EVIDENCE_USED, 2.5, 2.5, "FD");

  doc.setFillColor(59, 130, 246);
  doc.rect(ex + 3, ey + 4, 1.2, 7, "F");
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("판독 근거", ex + 6.5, ey + 9.5, TX);

  const rowStart = ey + 14;

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("카테고리", ex + 6.5, rowStart + 3, TX);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  let ryLine = rowStart + 2;
  for (const cl of catLines) {
    doc.text(cl, valX, ryLine + 3.6, TX);
    ryLine += 3.5;
  }

  const yCore = rowStart + catH + rowGap;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("핵심 판단", ex + 6.5, yCore + 3, TX);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  ryLine = yCore + 1;
  for (const cl of coreLines) {
    doc.text(cl, valX, ryLine + 3.6, TX);
    ryLine += 3.5;
  }

  const yReason = yCore + coreH + rowGap;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("근거", ex + 6.5, yReason + 3, TX);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  ryLine = yReason + 1;
  for (const cl of reasonLines) {
    doc.text(cl, valX, ryLine + 3.6, TX);
    ryLine += 3.5;
  }

  const yRec = yReason + reasonH + rowGap;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("권장", ex + 6.5, yRec + 3, TX);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  ryLine = yRec + 1;
  for (const cl of recLines) {
    doc.text(cl, valX, ryLine + 3.6, TX);
    ryLine += 3.5;
  }

  /* ----- 우: 메트릭 2컬럼(판독 근거 바로 아래, 하단 고정 아님) ----- */
  const mx = rx;
  const my = Math.min(
    ey + EVIDENCE_USED + GAP,
    footerTop - METRICS_H - 1,
  );
  const mw = (colRW - GAP) / 2;
  doc.setFillColor(248, 249, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(mx, my, mw, METRICS_H, 2, 2, "FD");
  doc.roundedRect(mx + mw + GAP, my, mw, METRICS_H, 2, 2, "FD");

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("CONFIDENCE", mx + 3, my + 5, TX);
  doc.setFontSize(14);
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  const confValY = confidenceTooltip ? my + 11.5 : my + 13;
  doc.text(String(data.confidenceText || "—"), mx + 3, confValY, TX);
  if (confidenceTooltip) {
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    const footLines = clipLines(
      wrapKoreanText(confidenceTooltip, 5.8, mw - 6),
      3,
    );
    let fny = confValY + 4;
    for (const fl of footLines) {
      doc.text(fl, mx + 3, fny, TX);
      fny += 2.9;
    }
  }
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Confidence", mx + 3, my + METRICS_H - 3, TX);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("DETECTION", mx + mw + GAP + 3, my + 5, TX);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const detStr = String(data.detectionLabel || "—");
  const detOne = clipLines(wrapKoreanText(detStr, 10, mw - 6), 2);
  let dy = my + 12;
  for (const dl of detOne) {
    doc.text(dl, mx + mw + GAP + 3, dy, TX);
    dy += 4.2;
  }

  /* ----- 푸터 ----- */
  const fy = footerTop;
  doc.setFillColor(248, 249, 255);
  doc.rect(0, fy, PAGE_W, FOOTER_H, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.45);
  doc.line(0, fy, PAGE_W, fy);

  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "본 문서는 웹 검증 결과와 동일한 데이터·계산 규칙으로 생성되었으며, 법적 효력이 없습니다.",
    M,
    fy + 7,
    TX,
  );
  doc.text("© 2025 FAITH Project.", PAGE_W - M, fy + 4.5, {
    align: "right",
    ...TX,
  });
  doc.text("한신대학교 AI·SW 캡스톤디자인.", PAGE_W - M, fy + 8.5, {
    align: "right",
    ...TX,
  });

  if (hasAgents) {
    doc.addPage();
    await ensureNanumFont(doc);
    drawAiAnalysisCardOnPage1(
      doc,
      M,
      M + 6,
      aiCardWFull,
      data.agents,
      data.finalCategory != null ? String(data.finalCategory) : "",
      { compact: true },
    );
  }

  const name =
    typeof filename === "string" && filename.trim()
      ? filename.trim().endsWith(".pdf")
        ? filename.trim()
        : `${filename.trim()}.pdf`
      : "faith-result.pdf";

  doc.save(name);
}
