import React from "react";
import { Shield } from "lucide-react";

const Header = ({ active, onNavigate }) => {
    const NavBtn = ({ id, label }) => (
        <button
            onClick={() => onNavigate(id)}
            className="text-sm font-bold text-slate-900 
                    hover:text-blue-600 
                    transition-colors duration-200
                    focus:outline-none focus:ring-0"
        >
            {label}
        </button>
    );


    return (
        <header className="w-full bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">

            {/* 🔹 로고 (hover 효과 없음) */}
            <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-2 font-black tracking-tight text-blue-600
                        focus:outline-none focus:ring-0"

            >
            <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Shield className="w-5 h-5" />
            </span>
            <span className="text-xl">FAITH</span>
            </button>

            <nav className="hidden md:flex items-center gap-8 mx-auto">
            <NavBtn id="home" label="홈" />
            <NavBtn id="reports" label="팩트체크 리포트" />
            <NavBtn id="verify" label="미디어 검증소" />
            <NavBtn id="about" label="서비스 소개" />
            </nav>

            <div className="ml-auto">
                <button className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-bold 
                                hover:bg-blue-700 transition
                                focus:outline-none focus:ring-0">
                로그인
                </button>
            </div>

        </div>
        </header>
    );
};

export default Header;
