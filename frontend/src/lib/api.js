// src/lib/api.js
import { tokenStorage } from "./token";

async function parseJsonSafely(res) {
  const text = await res.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    const proxyOrDown =
      res.status >= 502 && res.status <= 504
        ? " 백엔드(uvicorn)가 http://127.0.0.1:8000 에서 실행 중인지 확인하세요."
        : "";
    const looksHtml = /^\s*</.test(text);
    const hint = looksHtml
      ? " HTML이 반환되었습니다. 주소/프록시가 API가 아닌 페이지를 가리키는지 확인하세요."
      : proxyOrDown;
    throw {
      error_code: "INVALID_RESPONSE",
      message: `서버 응답이 JSON이 아니어서 처리할 수 없습니다.${hint}`,
      detail: null,
    };
  }
}

async function request(url, options = {}) {
  const token = tokenStorage.get();

  const res = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await parseJsonSafely(res);

  if (!res.ok) {
    const detailObj =
      data.detail && typeof data.detail === "object" && !Array.isArray(data.detail)
        ? data.detail
        : null;
    throw {
      error_code: detailObj?.error_code ?? data.error_code ?? "UNKNOWN_ERROR",
      message:
        detailObj?.message ??
        (typeof data.detail === "string" ? data.detail : null) ??
        data.message ??
        "요청 처리 중 오류가 발생했습니다.",
      detail: data.detail ?? null,
    };
  }

  return data;
}

export const api = {
  /**
   * GET JSON
   */
  get: (url, options = {}) => request(url, { method: "GET", ...options }),

  /**
   * POST JSON
   */
  post: (url, body, options = {}) =>
    request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: JSON.stringify(body ?? {}),
      ...options,
    }),

  /**
   * PUT JSON (필요 시)
   */
  put: (url, body, options = {}) =>
    request(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: JSON.stringify(body ?? {}),
      ...options,
    }),

  /** FETCH JSON */
  patch: (url, body) =>
    request(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  /**
   * DELETE JSON (필요 시)
   */
  del: (url, options = {}) => request(url, { method: "DELETE", ...options }),

  /**
   * FormData 업로드 (이미지/영상 등)
   * - Content-Type 지정 금지 (boundary 자동)
   */
  upload: (url, formData, options = {}) => {
    if (!(formData instanceof FormData)) {
      throw {
        error_code: "INVALID_INPUT",
        message: "upload는 FormData를 인자로 받아야 합니다.",
        detail: null,
      };
    }

    return request(url, {
      method: "POST",
      body: formData,
      // headers에 Content-Type 넣지 말 것!
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });
  },
};
