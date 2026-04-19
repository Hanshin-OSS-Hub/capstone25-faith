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
      className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all
        ${
          disabled
            ? "border-slate-200 bg-slate-100 cursor-not-allowed opacity-70"
            : selectedFile
            ? "border-blue-500 bg-blue-50"
            : isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 bg-slate-50 hover:border-blue-300 cursor-pointer"
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
                ? "bg-slate-200 text-slate-400"
                : selectedFile
                  ? "bg-blue-600 text-white"
                  : "bg-white shadow-sm text-blue-600"
            }`}
        >
          {selectedFile ? <CheckCircle2 size={32} /> : <Upload size={32} />}
        </div>

        <p className="font-bold text-lg text-slate-700">
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
          <p className="text-slate-400 text-sm mt-1">
            {disabled
              ? "검증 중에는 파일을 변경할 수 없습니다."
              : "클릭하거나 파일을 이 곳으로 드래그하세요"}
          </p>
        )}
      </label>
    </div>
  );
}
