import React from "react";
import { Shield } from "lucide-react";

const Footer = () => {
    return (
        <footer className="mt-20">
        <div className="bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="flex items-center gap-2 mb-6">
                <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Shield className="w-5 h-5" />
                </span>
                <span className="text-white font-black text-xl">FAITH</span>
            </div>

            <p className="text-slate-400 text-sm leading-relaxed">
                © 2025 FAITH Project, 한신대학교 AI·SW 캡스톤디자인.
            </p>
            </div>
        </div>
        </footer>
    );
};

export default Footer;
