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
    <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-xl space-y-8">
      <h1 className="text-3xl font-black text-center">로그인</h1>

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
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div className="text-center pt-3">
          <span className="text-sm text-slate-400 font-medium">
            아직 계정이 없나요?{" "}
            <Link
              to="/signup"
              className="text-blue-600 font-black"
            >
              회원가입하기
            </Link>
          </span>
        </div>
      </form>
    </div>
  );
}
