/**
 * validators.js
 * -----------------
 * 입력 검증 / 검증 가능 여부 판단 / 에러 메시지 정의
 * UI(React)와 완전히 분리된 순수 로직
 */

/**
 * 텍스트 길이 계산 (trim 기준)
 */
export function getTextLength(text) {
  if (typeof text !== "string") return 0;
  return text.trim().length;
}

/**
 * 텍스트가 검증 조건을 만족하는지
 * @param {string} text
 * @param {number} minLength
 */
export function isValidText(text, minLength = 5) {
  return getTextLength(text) >= minLength;
}

/**
 * 파일 객체가 유효한지 (확장 가능)
 * @param {File|null|undefined} file
 */
export function isValidFile(file) {
  return file instanceof File;
}

/**
 * 검증을 시작할 수 있는지 여부
 * - 파일이 있거나
 * - 텍스트가 최소 글자 수 이상이면 true
 */
export function canAnalyze({ text, file, minTextLength = 5 }) {
  if (isValidFile(file)) return true;
  if (isValidText(text, minTextLength)) return true;
  return false;
}

/**
 * 검증 시작 전 에러 체크
 * 실패 시 { title, message } 반환
 * 성공 시 null
 */
export function getAnalyzeError({ text, file, minTextLength = 5 }) {
  if (isValidFile(file)) return null;

  const length = getTextLength(text);
  if (length < minTextLength) {
    return {
      title: "입력이 부족합니다",
      message: `검증을 시작하려면 ${minTextLength}자 이상의 텍스트를 입력하거나 검증할 파일을 선택해 주세요.`,
    };
  }

  return null;
}

/**
 * (선택) 파일 타입 검증 – 나중에 쓰라고 미리 준비
 */
export function isAllowedFileType(file, allowedTypes = []) {
  if (!isValidFile(file)) return false;
  if (allowedTypes.length === 0) return true;
  return allowedTypes.includes(file.type);
}

/**
 * (선택) 파일 크기 검증 – 나중에 쓰라고 미리 준비
 * @param {File} file
 * @param {number} maxSizeMB
 */
export function isAllowedFileSize(file, maxSizeMB = 10) {
  if (!isValidFile(file)) return false;
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}
