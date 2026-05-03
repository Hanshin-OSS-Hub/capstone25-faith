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
        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          <MessageSquareText size={14} /> Text Content
        </label>

        <span
          className={`text-[10px] px-2 py-1 rounded font-bold transition-all
            ${
              textLength >= 5
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            }`}
        >
          {textLength} / 5자 이상
        </span>
      </div>

      <textarea
        ref={textareaRef}
        disabled={disabled}
        className={`h-32 w-full resize-none rounded-3xl border border-slate-100 p-6 shadow-inner outline-none transition-all dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:placeholder:text-slate-500 ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            : "bg-slate-50 focus:border-blue-500 focus:bg-white dark:focus:border-blue-500 dark:focus:bg-slate-900"
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
