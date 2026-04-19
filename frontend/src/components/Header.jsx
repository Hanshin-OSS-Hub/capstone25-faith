import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { isLoggedIn, logout } from "../lib/auth";

export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const loggedIn = isLoggedIn();

  return (
    <header className="sticky top-0 z-50 border-b border-blue-200 bg-white">
      <div className="max-w-7xl mx-auto h-20 flex items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <ShieldCheck className="text-blue-600" />
          <span className="font-black text-blue-600">FAITH</span>
        </Link>

        <nav className="flex gap-8 font-bold text-slate-800">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `transition-colors duration-200 hover:text-blue-600 ${
                isActive ? "text-blue-600" : ""
              }`
            }
          >
            홈
          </NavLink>
          <NavLink
            to="/archive"
            className={({ isActive }) =>
              `transition-colors duration-200 hover:text-blue-600 ${
                isActive || pathname.startsWith("/archive") ? "text-blue-600" : ""
              }`
            }
          >
            아카이브
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `transition-colors duration-200 hover:text-blue-600 ${
                isActive ? "text-blue-600" : ""
              }`
            }
          >
            서비스 소개
          </NavLink>
        </nav>

        {/* 우측 액션 영역 */}
        <div className="flex items-center gap-3">
          {loggedIn ? (
            <>
              <Link
                to="/mypage"
                className="text-xs font-black text-slate-900 transition-colors hover:text-blue-600"
              >
                마이페이지
              </Link>

              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="rounded-full bg-blue-600 px-5 py-2 text-xs font-black text-white transition-colors hover:bg-blue-700"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                to="/signup"
                className="text-blue-600 text-xs font-black"
              >
                회원가입
              </Link>

              <Link
                to="/login"
                className="bg-blue-600 text-white px-5 py-2 rounded-full text-xs font-black"
              >
                로그인
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
