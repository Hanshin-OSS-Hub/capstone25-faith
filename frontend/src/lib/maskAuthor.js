/**
 * 작성자 표시: 앞 2글자만, 나머지 ***
 * @param {string|null|undefined} author
 * @returns {string}
 */
export function maskAuthorDisplay(author) {
  const s = author != null ? String(author).trim() : "";
  if (!s) return "—";
  if (s.length <= 2) return s;
  return `${s.slice(0, 2)}***`;
}
