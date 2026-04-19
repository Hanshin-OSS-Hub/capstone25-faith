// src/lib/analyze.js
import { api } from "./api";

/**
 * 텍스트 검증(MAS) 요청
 * POST /api/ai/mas/text
 */
export async function analyzeText({
  content,
  language = "ko",
  session_id = null,
}) {
  if (typeof content !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "content는 문자열이어야 합니다.",
      detail: null,
    };
  }

  const trimmed = content.trim();
  if (trimmed.length < 1) {
    throw {
      error_code: "INVALID_INPUT",
      message: "검증할 텍스트가 비어 있습니다.",
      detail: null,
    };
  }

  const body = {
    text: trimmed,
  };

  return api.post("/api/ai/mas/text", body);
}

/**
 * 미디어 검증(MAS) 요청
 * POST /api/ai/mas/media
 */
export async function analyzeMedia({
  file,
  description = "",
  session_id = null,
}) {
  if (!(file instanceof File)) {
    throw {
      error_code: "INVALID_INPUT",
      message: "file은 File 객체여야 합니다.",
      detail: null,
    };
  }

  const formData = new FormData();
  formData.append("image", file);
  if (description) formData.append("text", description);

  return api.upload("/api/ai/mas/media", formData);
}
