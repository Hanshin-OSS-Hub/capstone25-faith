// src/lib/analyze.js
import { api } from "./api";

/**
 * @typedef {{ is_logged_in: boolean, age: number|null, gender: string }} MasUserContext
 */

/**
 * 텍스트 검증(MAS) 요청
 * POST /api/ai/mas/text
 */
export async function analyzeText({
  content,
  language = "ko",
  session_id = null,
  signal,
  masUser,
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

  const u = masUser || {
    is_logged_in: false,
    age: null,
    gender: "other",
  };
  const body = {
    text: trimmed,
    is_logged_in: Boolean(u.is_logged_in),
    gender: u.gender || "other",
    ...(u.age != null && Number.isFinite(Number(u.age))
      ? { age: Math.round(Number(u.age)) }
      : {}),
  };

  return api.post("/api/ai/mas/text", body, signal ? { signal } : {});
}

/**
 * 미디어 검증(MAS) 요청
 * POST /api/ai/mas/media
 */
export async function analyzeMedia({
  file,
  description = "",
  session_id = null,
  signal,
  masUser,
}) {
  if (!(file instanceof File)) {
    throw {
      error_code: "INVALID_INPUT",
      message: "file은 File 객체여야 합니다.",
      detail: null,
    };
  }

  const u = masUser || {
    is_logged_in: false,
    age: null,
    gender: "other",
  };
  const formData = new FormData();
  formData.append("image", file);
  if (description) formData.append("text", description);
  formData.append("is_logged_in", u.is_logged_in ? "true" : "false");
  formData.append("gender", u.gender || "other");
  if (u.age != null && Number.isFinite(Number(u.age))) {
    formData.append("age", String(Math.round(Number(u.age))));
  }

  return api.upload("/api/ai/mas/media", formData, signal ? { signal } : {});
}
