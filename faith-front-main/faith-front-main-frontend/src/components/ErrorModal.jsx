import { AlertCircle } from "lucide-react";

export default function ErrorModal({ open, title, message, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in fade-in">
        <div className="text-red-500 mb-4 flex justify-center">
          <AlertCircle className="w-12 h-12" />
        </div>

        <h3 className="text-xl font-black text-center mb-2">
          {title || "오류 발생"}
        </h3>

        <p className="text-slate-600 text-center text-sm mb-6">
          {message || "알 수 없는 오류가 발생했습니다."}
        </p>

        <button
          onClick={onClose}
          className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold active:scale-95 transition"
        >
          확인
        </button>
      </div>
    </div>
  );
}
