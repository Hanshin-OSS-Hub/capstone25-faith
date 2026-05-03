import React from "react";
import { Upload, CheckCircle2, X } from "lucide-react";

/**
 * UploadFile
 * - 드래그&드롭 + 클릭 업로드 UI
 * - 상태는 부모(HomeView)에서 관리: selectedFile, isDragging
 */
export default function UploadFile({
  selectedFile,
  isDragging,
  setIsDragging,
  onFileSelected,
  onClearFile,
  inputId = "fileInput",
  disabled = false,
}) {
  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragging?.(true);
      }}
      onDragLeave={() => {
        if (disabled) return;
        setIsDragging?.(false);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragging?.(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFileSelected?.(f);
      }}
      className={`rounded-3xl border-2 border-dashed p-10 text-center transition-all
        ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70 dark:border-slate-700 dark:bg-slate-800/80"
            : selectedFile
              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
              : isDragging
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                : "cursor-pointer border-slate-200 bg-slate-50 hover:border-blue-300 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-blue-500"
        }`}
    >
      <input
        type="file"
        id={inputId}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (disabled) return;
          const f = e.target.files?.[0];
          if (f) onFileSelected?.(f);
        }}
      />

      <label
        htmlFor={disabled ? undefined : inputId}
        className={`block ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all
            ${
              disabled
                ? "bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                : selectedFile
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400"
            }`}
        >
          {selectedFile ? <CheckCircle2 size={32} /> : <Upload size={32} />}
        </div>

        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
          {selectedFile ? selectedFile.name : "검증할 미디어 업로드"}
        </p>

        {selectedFile ? (
          <button
            type="button"
            onClick={(e) => {
              if (disabled) return;
              e.preventDefault();
              onClearFile?.();
            }}
            disabled={disabled}
            className={`text-xs font-bold mt-2 flex items-center justify-center gap-1 mx-auto ${
              disabled
                ? "text-slate-400 cursor-not-allowed"
                : "text-red-500 hover:underline"
            }`}
          >
            <X size={12} /> 파일 취소
          </button>
        ) : (
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            {disabled
              ? "검증 중에는 파일을 변경할 수 없습니다."
              : "클릭하거나 파일을 이곳으로 드래그하세요"}
          </p>
        )}
      </label>
    </div>
  );
}
