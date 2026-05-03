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
  Calendar,
  UserCircle,
  CheckCircle2,
} from "lucide-react";
import { api } from "../lib/api";
import { isLoggedIn, logout } from "../lib/auth";

/**
 * MyPageView
 * - 로그인 사용자만 접근 (토큰 없으면 /login 이동)
 * - phone, id(login_id), gender, birth는 수정 불가(UI + PATCH body에서 제외)
 */

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function formatGenderLabel(g) {
  if (g === "M") return "남성";
  if (g === "F") return "여성";
  if (g != null && String(g).trim()) return String(g).trim();
  return "-";
}

function formatBirthLabel(b) {
  if (b == null || b === "") return "-";
  const raw = typeof b === "string" ? b.split("T")[0] : b;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(b);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MyPageView() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 서버에서 받아온 원본(변경 감지용)
  const [initialUser, setInitialUser] = useState(null);

  // 화면에서 수정하는 값
  const [userInfo, setUserInfo] = useState({
    id: "",
    phone: "",
    name: "",
    email: "",
    occupation: "",
    gender: "",
    birth: "",
  });

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteDoneOpen, setDeleteDoneOpen] = useState(false);

  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

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
          gender: data.gender ?? "",
          birth: data.birth ?? "",
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
        gender: updated.gender ?? userInfo.gender,
        birth: updated.birth ?? userInfo.birth,
      };

      setInitialUser(mapped);
      setUserInfo(mapped);
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (e) {
      setError(e?.message || "정보 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");

    if (!deletePassword) {
      setDeleteError("회원 탈퇴를 위해 현재 비밀번호를 입력해 주세요.");
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleting) return;

    setDeleting(true);

    try {
      await api.del("/api/user/me", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: deletePassword }),
      });

      setDeleteConfirmOpen(false);
      logout();
      setDeleteDoneOpen(true);
    } catch (e) {
      setDeleteError(e?.message || "회원 탈퇴 중 오류가 발생했습니다.");
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
          마이페이지 불러오는 중...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="overflow-hidden rounded-[3rem] border border-slate-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
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
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                  사용자 아이디 (수정불가)
                </label>
                <div className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500">
                  <User size={18} />
                  <span className="text-sm font-bold">{userInfo.id || "-"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                  전화번호 (수정불가)
                </label>
                <div className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500">
                  <ShieldCheck size={18} />
                  <span className="text-sm font-bold">
                    {userInfo.phone || "-"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                  성별 (수정불가)
                </label>
                <div className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500">
                  <UserCircle size={18} />
                  <span className="text-sm font-bold">
                    {formatGenderLabel(userInfo.gender)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                  생년월일 (수정불가)
                </label>
                <div className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500">
                  <Calendar size={18} />
                  <span className="text-sm font-bold">
                    {formatBirthLabel(userInfo.birth)}
                  </span>
                </div>
              </div>
            </div>

            <hr className="border-slate-50 dark:border-slate-800" />

            {/* 수정 가능 섹션 */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-900 dark:text-slate-200">
                  이름 / 닉네임
                </label>
                <input
                  type="text"
                  value={userInfo.name}
                  onChange={(e) =>
                    setUserInfo((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-900 dark:text-slate-200">
                  이메일 주소
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    size={18}
                  />
                  <input
                    type="email"
                    value={userInfo.email}
                    onChange={(e) =>
                      setUserInfo((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-14 pr-5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <p className="ml-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  예: user@test.com
                </p>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-900 dark:text-slate-200">
                  직업 (Occupation)
                </label>
                <div className="relative">
                  <Briefcase
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
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
                    className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-14 pr-5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-50 dark:border-slate-800" />

            {/* 비밀번호 변경 섹션 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-900 dark:text-slate-200">
                  비밀번호 변경 (선택)
                </label>
                <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">
                  변경하려면 세 칸 모두 입력
                </span>
              </div>

              <div className="relative">
                <Lock
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  size={18}
                />
                <input
                  type="password"
                  placeholder="기존 비밀번호"
                  value={passwords.current}
                  onChange={(e) =>
                    setPasswords((prev) => ({ ...prev, current: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-14 pr-5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
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
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <input
                  type="password"
                  placeholder="새 비밀번호 확인"
                  value={passwords.confirm}
                  onChange={(e) =>
                    setPasswords((prev) => ({ ...prev, confirm: e.target.value }))
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
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
                    ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    : !isDirty
                      ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                      : "bg-blue-600 text-white shadow-blue-100 hover:-translate-y-1 hover:bg-blue-700 dark:shadow-blue-900/30"
                }`}
            >
              {saving ? "저장 중..." : "정보 수정 완료"}
            </button>

            <hr className="border-slate-50 dark:border-slate-800" />

            <div className="space-y-4 rounded-3xl border border-red-100 bg-red-50/60 p-6 dark:border-red-900/40 dark:bg-red-950/25">
              <div>
                <h3 className="text-base font-black text-red-600 dark:text-red-400">회원 탈퇴</h3>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  탈퇴 시 계정 정보와 회원에 연결된 주요 데이터가 삭제되며 복구할 수 없습니다.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-red-500 uppercase ml-1">
                  현재 비밀번호 확인
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    size={18}
                  />
                  <input
                    type="password"
                    placeholder="회원 탈퇴를 위해 현재 비밀번호 입력"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-2xl border border-red-200 bg-white py-4 pl-14 pr-5 text-sm font-bold outline-none focus:ring-2 focus:ring-red-400 dark:border-red-800 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-red-600/40"
                  />
                </div>
              </div>

              {deleteError && (
                <div className="flex items-center gap-2 text-red-500 px-2">
                  <AlertCircle size={14} />
                  <span className="text-[11px] font-black">{deleteError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className={`w-full py-4 rounded-2xl text-sm font-black transition-all ${
                  deleting
                    ? "cursor-not-allowed bg-red-100 text-red-300 dark:bg-red-950/50 dark:text-red-800"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                {deleting ? "회원 탈퇴 처리 중..." : "회원 탈퇴"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-100 bg-white p-8 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-950/60 dark:text-red-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h3 className="text-center text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
              회원 탈퇴 확인
            </h3>
            <p className="mt-3 text-center text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              탈퇴를 진행하면 계정 정보와 연결된 주요 기록이 삭제되며<br/> 되돌릴 수 없습니다.
            </p>
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-500 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              입력한 비밀번호로 본인 확인 후 즉시 탈퇴 처리됩니다.
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white transition ${
                  deleting
                    ? "bg-red-300 cursor-not-allowed"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {deleting ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteDoneOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-100 bg-white p-8 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-center text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
              탈퇴가 완료되었습니다
            </h3>
            <p className="mt-3 text-center text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              회원 계정이 정상적으로 삭제되었습니다.<br/> 확인을 누르면 로그인 화면으로 이동합니다.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteDoneOpen(false);
                navigate("/login", { replace: true });
              }}
              className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
