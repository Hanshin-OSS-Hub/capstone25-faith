import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Moon, ShieldCheck, Sun } from "lucide-react";
import { isLoggedIn, logout } from "../lib/auth";
import { useTheme } from "../theme/ThemeProvider.jsx";

export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const loggedIn = isLoggedIn();
  const { setTheme, resolved } = useTheme();

  const navInactive =
    "text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400";

  return (
    <header className="sticky top-0 z-50 border-b border-blue-200/80 bg-white/95 backdrop-blur-md transition-colors dark:border-slate-700 dark:bg-slate-900/95">
      <div className="max-w-7xl mx-auto h-20 flex items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <ShieldCheck className="text-blue-600 dark:text-blue-400" />
          <span className="font-black text-blue-600 dark:text-blue-400">FAITH</span>
        </Link>

        <nav className={`flex gap-8 font-bold ${navInactive}`}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `transition-colors duration-200 ${navInactive} ${
                isActive ? "!text-blue-600 dark:!text-blue-400" : ""
              }`
            }
          >
            홈
          </NavLink>
          <NavLink
            to="/archive"
            className={({ isActive }) =>
              `transition-colors duration-200 ${navInactive} ${
                isActive || pathname.startsWith("/archive")
                  ? "!text-blue-600 dark:!text-blue-400"
                  : ""
              }`
            }
          >
            아카이브
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `transition-colors duration-200 ${navInactive} ${
                isActive ? "!text-blue-600 dark:!text-blue-400" : ""
              }`
            }
          >
            서비스 소개
          </NavLink>
        </nav>

        {/* 우측 액션 영역 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setTheme(resolved === "light" ? "dark" : "light")
            }
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-amber-200/90 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-amber-100 dark:focus-visible:ring-offset-slate-900"
            title={
              resolved === "light"
                ? "다크 모드로 전환"
                : "라이트 모드로 전환"
            }
            aria-label={
              resolved === "light"
                ? "다크 모드로 전환"
                : "라이트 모드로 전환"
            }
          >
            {resolved === "light" ? (
              <Sun className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            ) : (
              <Moon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            )}
          </button>
          {loggedIn ? (
            <>
              <Link
                to="/mypage"
                className="text-xs font-black text-slate-900 transition-colors hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
              >
                마이페이지
              </Link>

              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="rounded-full bg-blue-600 px-5 py-2 text-xs font-black text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                to="/signup"
                className="text-xs font-black text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                회원가입
              </Link>

              <Link
                to="/login"
                className="rounded-full bg-blue-600 px-5 py-2 text-xs font-black text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
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
