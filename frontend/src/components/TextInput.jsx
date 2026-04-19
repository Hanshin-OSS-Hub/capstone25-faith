import React from "react";
import { MessageSquareText } from "lucide-react";

/**
 * TextInput
 * - textarea + 글자수 뱃지
 * - IME 조합 상태/이벤트는 부모(HomeView)에서 처리
 * - textareaRef는 부모가 만들어서 넘겨줌(판정 시 state 지연/IME 이슈 방지)
 */
export default function TextInput({
  textareaRef,
  value,
  onChange,
  textLength,
  onCompositionStart,
  onCompositionEnd,
  placeholder = "검증할 텍스트 내용을 입력하세요...",
  disabled = false,
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <MessageSquareText size={14} /> Text Content
        </label>

        <span
          className={`text-[10px] px-2 py-1 rounded font-bold transition-all
            ${textLength >= 5 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}
        >
          {textLength} / 5자 이상
        </span>
      </div>

      <textarea
        ref={textareaRef}
        disabled={disabled}
        className={`w-full h-32 p-6 border border-slate-100 rounded-3xl outline-none transition-all resize-none shadow-inner ${
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : "bg-slate-50 focus:border-blue-500 focus:bg-white"
        }`}
        placeholder={disabled ? "검증 중에는 텍스트를 수정할 수 없습니다." : placeholder}
        value={value}
        onChange={onChange}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      />
    </div>
  );
}
