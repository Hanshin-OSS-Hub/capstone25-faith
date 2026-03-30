import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { api } from "../lib/api";
import { isLoggedIn } from "../lib/auth";

/**
 * MyPageView
 * - 로그인 사용자만 접근 (토큰 없으면 /login 이동)
 * - phone, id(login_id)는 수정 불가(UI + 요청 body에서 제외)
 */

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function MyPageView() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 서버에서 받아온 원본(변경 감지용)
  const [initialUser, setInitialUser] = useState(null);

  // 화면에서 수정하는 값
  const [userInfo, setUserInfo] = useState({
    id: "",
    phone: "",
    name: "",
    email: "",
    occupation: "",
  });

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [error, setError] = useState("");

  // --- 접근 가드: 토큰 없으면 로그인 페이지로 ---
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // --- 사용자 정보 로드 ---
  useEffect(() => {
    const fetchMe = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await api.get("/api/user/me");

        // 백엔드 키가 다를 수 있어서 안전하게 매핑
        const mapped = {
          id: data.login_id ?? data.id ?? "",
          phone: data.phone ?? "",
          name: data.name ?? "",
          email: data.email ?? "",
          occupation: data.occupation ?? "",
        };

        setInitialUser(mapped);
        setUserInfo(mapped);
      } catch (e) {
        setError(e?.message || "사용자 정보를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  const hasAnyPwInput = useMemo(() => {
    return !!(passwords.current || passwords.next || passwords.confirm);
  }, [passwords]);

  const isDirty = useMemo(() => {
    if (!initialUser) return false;
    const profileChanged =
      initialUser.name !== userInfo.name ||
      initialUser.email !== userInfo.email ||
      (initialUser.occupation ?? "") !== (userInfo.occupation ?? "");
    return profileChanged || hasAnyPwInput;
  }, [initialUser, userInfo, hasAnyPwInput]);

  const validate = () => {
    // 프로필 값 최소 검증
    if (!userInfo.name.trim()) return "이름을 입력해 주세요.";
    if (!emailRegex.test(userInfo.email.trim()))
      return "이메일 형식이 올바르지 않습니다.";

    // 비밀번호 변경을 시도하는 경우에만 검증
    if (hasAnyPwInput) {
      if (!passwords.current) return "기존 비밀번호를 입력해 주세요.";
      if (!passwords.next) return "새 비밀번호를 입력해 주세요.";
      if (passwords.next.length < 8)
        return "새 비밀번호는 최소 8자 이상이어야 합니다.";
      if (passwords.next === passwords.current)
        return "기존 비밀번호와 동일한 비밀번호를 사용할 수 없습니다.";
      if (passwords.next !== passwords.confirm)
        return "새 비밀번호 확인이 일치하지 않습니다.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setError("");
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);

    try {
      // PATCH body: 수정 가능한 필드만 보냄
      const body = {
        name: userInfo.name.trim(),
        email: userInfo.email.trim(),
        occupation: (userInfo.occupation ?? "").trim(),
        ...(hasAnyPwInput
          ? {
              current_password: passwords.current,
              new_password: passwords.next,
            }
          : {}),
      };

      const updated = await api.patch("/api/user/me", body);

      // 서버 응답에 따라 다시 세팅(최신 값 유지)
      const mapped = {
        id: updated.login_id ?? updated.id ?? userInfo.id,
        phone: updated.phone ?? userInfo.phone,
        name: updated.name ?? userInfo.name,
        email: updated.email ?? userInfo.email,
        occupation: updated.occupation ?? userInfo.occupation,
      };

      setInitialUser(mapped);
      setUserInfo(mapped);
      setPasswords({ current: "", next: "", confirm: "" });

      alert("정보가 성공적으로 수정되었습니다.");
    } catch (e) {
      setError(e?.message || "정보 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold text-sm">
          마이페이지 불러오는 중...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
        {/* 헤더 섹션 */}
        <div className="bg-slate-900 p-10 text-white">
          <h2 className="text-3xl font-black tracking-tighter mb-2">
            마이페이지
          </h2>
          <p className="text-slate-400 text-sm font-medium">
            개인 정보 및 보안 설정을 관리하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          {/* 읽기 전용 섹션 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                사용자 아이디 (수정불가)
              </label>
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 cursor-not-allowed">
                <User size={18} />
                <span className="text-sm font-bold">{userInfo.id || "-"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                전화번호 (수정불가)
              </label>
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 cursor-not-allowed">
                <ShieldCheck size={18} />
                <span className="text-sm font-bold">
                  {userInfo.phone || "-"}
                </span>
              </div>
            </div>
          </div>

          <hr className="border-slate-50" />

          {/* 수정 가능 섹션 */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-900 uppercase ml-1">
                이름 / 닉네임
              </label>
              <input
                type="text"
                value={userInfo.name}
                onChange={(e) =>
                  setUserInfo((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-900 uppercase ml-1">
                이메일 주소
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="email"
                  value={userInfo.email}
                  onChange={(e) =>
                    setUserInfo((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full pl-14 pr-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold ml-1">
                예: user@test.com
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-900 uppercase ml-1">
                직업 (Occupation)
              </label>
              <div className="relative">
                <Briefcase
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  value={userInfo.occupation ?? ""}
                  onChange={(e) =>
                    setUserInfo((prev) => ({
                      ...prev,
                      occupation: e.target.value,
                    }))
                  }
                  placeholder="예: 학생, 직장인, 연구원"
                  className="w-full pl-14 pr-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-50" />

          {/* 비밀번호 변경 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-900 uppercase ml-1">
                비밀번호 변경 (선택)
              </label>
              <span className="text-[10px] font-bold text-slate-300">
                변경하려면 세 칸 모두 입력
              </span>
            </div>

            <div className="relative">
              <Lock
                className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="password"
                placeholder="기존 비밀번호"
                value={passwords.current}
                onChange={(e) =>
                  setPasswords((prev) => ({ ...prev, current: e.target.value }))
                }
                className="w-full pl-14 pr-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="password"
                placeholder="새 비밀번호 (8자 이상)"
                value={passwords.next}
                onChange={(e) =>
                  setPasswords((prev) => ({ ...prev, next: e.target.value }))
                }
                className="px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="새 비밀번호 확인"
                value={passwords.confirm}
                onChange={(e) =>
                  setPasswords((prev) => ({ ...prev, confirm: e.target.value }))
                }
                className="px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 px-2">
                <AlertCircle size={14} />
                <span className="text-[11px] font-black">{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !isDirty}
            className={`w-full py-5 rounded-2xl text-sm font-black shadow-xl transition-all transform
              ${
                saving
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : !isDirty
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1"
              }`}
          >
            {saving ? "저장 중..." : "정보 수정 완료"}
          </button>
        </form>
      </div>
    </div>
  );
}
