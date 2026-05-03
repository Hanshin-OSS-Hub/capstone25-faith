import { AlertCircle } from "lucide-react";

export default function ErrorModal({ open, title, message, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl animate-in fade-in dark:border-slate-600 dark:bg-slate-900">
        <div className="mb-4 flex justify-center text-red-500 dark:text-red-400">
          <AlertCircle className="w-12 h-12" />
        </div>

        <h3 className="mb-2 text-center text-xl font-black text-slate-900 dark:text-slate-50">
          {title || "오류 발생"}
        </h3>

        <p className="mb-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {message || "알 수 없는 오류가 발생했습니다."}
        </p>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white transition active:scale-95 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
