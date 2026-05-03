import React, { useState } from "react";
import { User, Lock } from "lucide-react";
import LoginInput from "../components/LoginInput";
import { login } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

export default function LoginView({ onError }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    login_id: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(form);
      navigate("/"); // 로그인 성공 시 홈으로 이동
    } catch (err) {
      onError?.("로그인 실패", err.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-8 rounded-3xl border border-slate-100 bg-white p-10 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-center text-3xl font-black text-slate-900 dark:text-slate-50">로그인</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <LoginInput
          label="아이디"
          icon={User}
          placeholder="아이디를 입력하세요"
          value={form.login_id}
          onChange={(e) => setForm({ ...form, login_id: e.target.value })}
        />

        <LoginInput
          label="비밀번호"
          icon={Lock}
          type="password"
          placeholder="비밀번호를 입력하세요"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-xl font-black transition-all
            ${
              loading
                ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div className="text-center pt-3">
          <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
            아직 계정이 없나요?{" "}
            <Link
              to="/signup"
              className="font-black text-blue-600 dark:text-blue-400"
            >
              회원가입하기
            </Link>
          </span>
        </div>
      </form>
    </div>
  );
}
