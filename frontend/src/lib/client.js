import { tokenStorage } from "./token";

const API_BASE = "";

export async function apiFetch(url, options = {}) {
  const token = tokenStorage.get();

  const res = await fetch(`${API_BASE}${url}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.message || "서버 오류가 발생했습니다.";
    throw new Error(message);
  }

  return data;
}
