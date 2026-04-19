import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  UserCircle,
  Phone,
  Mail,
  Calendar,
  ChevronLeft,
  Check,
  X,
} from "lucide-react";
import LoginInput from "../components/LoginInput";
import { checkLoginId, signup } from "../lib/auth";

const SignUpView = ({ onBack, onSignupSuccess, onError }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    login_id: "",
    password: "",
    password_confirm: "",
    name: "",
    phone: "",
    email: "",
    gender: "M",
    birth: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [idChecked, setIdChecked] = useState(false);
  const [idCheckResult, setIdCheckResult] = useState(null); // null | "available" | "duplicate"

  /** -------- helpers -------- */

  const normalizedPhone = useMemo(
    () => formData.phone.replace(/[^\d]/g, ""),
    [formData.phone],
  );

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
    [formData.email],
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // 아이디 변경 시 중복확인 무효화
    if (name === "login_id") {
      setIdChecked(false);
      setIdCheckResult(null);
    }
  };

  /** -------- validation -------- */

  const validateForm = () => {
    if (formData.login_id.length < 4) {
      return "아이디는 최소 4자 이상이어야 합니다.";
    }

    if (!idChecked) {
      return "아이디 중복확인을 해주세요.";
    }

    if (formData.password.length < 8) {
      return "비밀번호는 최소 8자 이상이어야 합니다.";
    }

    if (formData.password !== formData.password_confirm) {
      return "비밀번호가 일치하지 않습니다.";
    }

    if (!formData.name.trim()) {
      return "이름을 입력해 주세요.";
    }

    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      return "전화번호는 숫자만 10~11자리로 입력해 주세요.";
    }

    if (!emailValid) {
      return "올바른 이메일 형식을 입력해 주세요.";
    }

    if (!formData.birth) {
      return "생년월일을 선택해 주세요.";
    }

    return null;
  };

  /** -------- API stubs -------- */

  const checkDuplicateId = async () => {
    if (formData.login_id.length < 4) {
      onError?.("입력 오류", "아이디는 최소 4자 이상이어야 합니다.");
      return;
    }

    if (isCheckingId) return;
    setIsCheckingId(true);
    setIdCheckResult(null);

    try {
      const res = await checkLoginId(formData.login_id);
      if (res?.available) {
        setIdCheckResult("available");
        setIdChecked(true);
      } else {
        setIdCheckResult("duplicate");
        setIdChecked(false);
      }
    } catch (err) {
      onError?.("중복 확인 실패", err?.message || "아이디 중복 확인 중 오류가 발생했습니다.");
      setIdCheckResult(null);
    } finally {
      setIsCheckingId(false);
    }
  };

  /** -------- submit -------- */

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const errorMessage = validateForm();
    if (errorMessage) {
      onError?.("회원가입 오류", errorMessage);
      return;
    }

    setIsLoading(true);

    try {
      const { password_confirm, ...rest } = formData;
      const payload = {
        ...rest,
        phone: normalizedPhone,
      };

      await signup(payload);
      onSignupSuccess?.();
      navigate("/login", { replace: true });
    } catch (err) {
      const message = err?.message || "회원가입 중 오류가 발생했습니다.";
      onError?.("회원가입 실패", message);
    } finally {
      setIsLoading(false);
    }
  };

  /** -------- UI -------- */

  return (
    <div className="flex items-center justify-center py-6 min-h-[80vh]">
      <div className="w-full max-w-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10 space-y-8">
        {/* Header */}
        <div className="relative">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="absolute -left-2 top-1 text-slate-400 hover:text-blue-600"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-3xl font-black text-center">회원가입</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ID + 중복확인 */}
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <LoginInput
                  label="아이디"
                  name="login_id"
                  icon={User}
                  value={formData.login_id}
                  onChange={handleChange}
                  required
                />
              </div>
              <button
                type="button"
                onClick={checkDuplicateId}
                disabled={isCheckingId}
                className="shrink-0 h-[52px] px-4 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap"
              >
                {isCheckingId ? "확인 중..." : "중복확인"}
              </button>
            </div>
            {idCheckResult && (
              <p
                className={`mt-1.5 px-1 text-sm font-bold ${
                  idCheckResult === "available" ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {idCheckResult === "available"
                  ? "사용가능한 아이디입니다."
                  : "이미 존재하는 아이디입니다."}
              </p>
            )}
          </div>

          <>
            <LoginInput
              label="비밀번호"
              name="password"
              type="password"
              icon={Lock}
              value={formData.password}
              onChange={handleChange}
              required
            />
            <div className="mt-1.5 px-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                비밀번호 조건
              </p>
              <div
                className={
                  formData.password.length >= 8
                    ? "flex items-center justify-between gap-2 text-sm font-medium text-emerald-600"
                    : "flex items-center justify-between gap-2 text-sm font-medium text-slate-400"
                }
              >
                <span className="flex items-center gap-2">
                  {formData.password.length >= 8 ? (
                    <Check size={14} className="shrink-0" />
                  ) : (
                    <X size={14} className="shrink-0" />
                  )}
                  8자 이상
                </span>
                <span className="font-bold">
                  {formData.password.length >= 8 ? "만족" : "미만족"}
                </span>
              </div>
            </div>
          </>

          <div>
            <LoginInput
              label="비밀번호 확인"
              name="password_confirm"
              type="password"
              icon={Lock}
              value={formData.password_confirm}
              onChange={handleChange}
              placeholder="비밀번호를 다시 입력하세요"
              required
            />
            {formData.password_confirm && (
              <p
                className={
                  formData.password === formData.password_confirm
                    ? "mt-1.5 px-1 text-sm font-bold text-emerald-600"
                    : "mt-1.5 px-1 text-sm font-bold text-red-500"
                }
              >
                {formData.password === formData.password_confirm
                  ? "비밀번호가 일치합니다."
                  : "비밀번호가 일치하지 않습니다."}
              </p>
            )}
          </div>

          <LoginInput
            label="이름"
            name="name"
            icon={UserCircle}
            value={formData.name}
            onChange={handleChange}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LoginInput
              label="전화번호"
              name="phone"
              icon={Phone}
              value={formData.phone}
              onChange={handleChange}
              required
            />
            <LoginInput
              label="이메일"
              name="email"
              type="email"
              icon={Mail}
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* gender + birth */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400">성별</label>
              <div className="flex gap-2 mt-2">
                {["M", "F"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, gender: g }))
                    }
                    className={`flex-1 py-3 rounded-xl font-bold ${
                      formData.gender === g
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {g === "M" ? "남성" : "여성"}
                  </button>
                ))}
              </div>
            </div>

            <LoginInput
              label="생년월일"
              name="birth"
              type="date"
              icon={Calendar}
              value={formData.birth}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={
              isLoading
                ? "w-full py-5 rounded-2xl font-black bg-slate-100 text-slate-400 cursor-not-allowed transition-all"
                : "w-full py-5 rounded-2xl font-black bg-blue-600 text-white hover:bg-blue-700 transition-all"
            }
          >
            {isLoading ? "가입 처리 중..." : "가입하기"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignUpView;
