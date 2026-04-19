// src/lib/auth.js
import { api } from "./api";
import { tokenStorage } from "./token";

/**
 * 로그인
 * POST /api/auth/login
 * body: { login_id, password }
 * resp: { access_token, ... } (가정)
 */
export async function login({ login_id, password }) {
  if (!login_id || typeof login_id !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "아이디(login_id)를 입력해 주세요.",
      detail: null,
    };
  }
  if (!password || typeof password !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "비밀번호(password)를 입력해 주세요.",
      detail: null,
    };
  }

  const data = await api.post("/api/auth/login", { login_id, password });

  if (data?.access_token) tokenStorage.set(data.access_token);
  return data;
}

/**
 * 로그아웃 (프론트 토큰 제거)
 * 백엔드 logout endpoint가 생기면 여기에서 api 호출 추가 가능
 */
export function logout() {
  tokenStorage.remove();
}

export function isLoggedIn() {
  return tokenStorage.isLoggedIn();
}

export function getAccessToken() {
  return tokenStorage.get();
}

/**
 * 아이디 중복확인
 * GET /api/auth/check-id?login_id=xxx
 * resp: { available: boolean, message?: string }
 */
export async function checkLoginId(login_id) {
  if (!login_id || typeof login_id !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "login_id는 문자열이어야 합니다.",
      detail: null,
    };
  }

  const qs = new URLSearchParams({ login_id }).toString();
  return api.get(`/api/auth/check-id?${qs}`);
}

/**
 * 회원가입
 * POST /api/auth/signup
 * body: { login_id, password, name, phone, email, gender, birth }
 */
export async function signup({
  login_id,
  password,
  name,
  phone,
  email,
  gender, // "M" | "F"
  birth, // "YYYY-MM-DD"
}) {
  if (!login_id || typeof login_id !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "아이디를 입력해 주세요.",
      detail: null,
    };
  }
  if (!password || typeof password !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "비밀번호를 입력해 주세요.",
      detail: null,
    };
  }
  if (!name || typeof name !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "이름을 입력해 주세요.",
      detail: null,
    };
  }
  if (!phone || typeof phone !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "전화번호를 입력해 주세요.",
      detail: null,
    };
  }
  if (!email || typeof email !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "이메일을 입력해 주세요.",
      detail: null,
    };
  }
  if (gender !== "M" && gender !== "F") {
    throw {
      error_code: "INVALID_INPUT",
      message: "성별은 'M' 또는 'F'여야 합니다.",
      detail: null,
    };
  }
  if (!birth || typeof birth !== "string") {
    throw {
      error_code: "INVALID_INPUT",
      message: "생년월일을 입력해 주세요.",
      detail: null,
    };
  }

  // phone은 숫자만
  const normalizedPhone = phone.replace(/\D/g, "");

  return api.post("/api/auth/signup", {
    login_id,
    password,
    name,
    phone: normalizedPhone,
    email,
    gender,
    birth,
  });
}
