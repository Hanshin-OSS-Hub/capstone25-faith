import { ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-16 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6 text-white font-black text-2xl tracking-tighter">
          <ShieldCheck className="text-blue-500" />
          FAITH
        </div>
        <p className="text-sm">
          © 2025 FAITH Project. 한신대학교 AI·SW 캡스톤디자인.
        </p>
      </div>
    </footer>
  );
}
