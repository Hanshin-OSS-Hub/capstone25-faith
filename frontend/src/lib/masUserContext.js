import { api } from "./api";
import { isLoggedIn } from "./auth";

/** 생년월일(ISO 또는 YYYY-MM-DD) → 만 나이. 파싱 실패 시 null */
export function computeAgeFromBirth(birth) {
  if (birth == null || birth === "") return null;
  const raw = typeof birth === "string" ? birth.split("T")[0] : String(birth);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const md = today.getMonth() * 32 + today.getDate() - (d.getMonth() * 32 + d.getDate());
  if (md < 0) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

/**
 * MAS(Gemini·영상·이미지)에 넘길 사용자 맥락.
 * 로그인 시 /api/user/me 로 나이·성별을 채우고, 비로그인은 개인화 미적용.
 */
export async function fetchMasUserContext() {
  const fallback = {
    is_logged_in: false,
    age: null,
    gender: "other",
  };
  if (!isLoggedIn()) return { ...fallback };

  try {
    const data = await api.get("/api/user/me");
    const birth = data.birth ?? null;
    const g = String(data.gender ?? "")
      .trim()
      .toUpperCase();
    let gender = "other";
    if (g === "F") gender = "woman";
    else if (g === "M") gender = "man";

    return {
      is_logged_in: true,
      age: computeAgeFromBirth(birth),
      gender,
    };
  } catch {
    return { is_logged_in: true, age: null, gender: "other" };
  }
}
