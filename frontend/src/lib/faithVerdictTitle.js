/**
 * 검증 결과 메인 제목 — 결과 화면·PDF 판정 카드에서 동일 문구 사용
 */

/** PDF 소제목 태그·제목용 (슬래시 주변 공백) */
export function formatVerdictDetectionLabel(label) {
  const s = String(label || "—").trim();
  if (!s) return "—";
  return s.replace(/\//g, " / ");
}

/**
 * @param {string|null|undefined} detectionLabel — DETECTION 정규화 라벨
 * @param {number|null|undefined} score100 — 통합 리스크 0~100
 */
export function buildFaithVerdictHeadline(detectionLabel, score100) {
  const label = formatVerdictDetectionLabel(detectionLabel);
  const n = Math.round(Math.max(0, Math.min(100, Number(score100) || 0)));
  return `[검증] ${label} · 위험 ${n}%`;
}
