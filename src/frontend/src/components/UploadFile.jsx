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
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging?.(true);
      }}
      onDragLeave={() => setIsDragging?.(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging?.(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFileSelected?.(f);
      }}
      className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer
        ${
          selectedFile
            ? "border-blue-500 bg-blue-50"
            : isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 bg-slate-50 hover:border-blue-300"
        }`}
    >
      <input
        type="file"
        id={inputId}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected?.(f);
        }}
      />

      <label htmlFor={inputId} className="cursor-pointer block">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all
            ${selectedFile ? "bg-blue-600 text-white" : "bg-white shadow-sm text-blue-600"}`}
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
              e.preventDefault();
              onClearFile?.();
            }}
            className="text-red-500 text-xs font-bold mt-2 hover:underline flex items-center justify-center gap-1 mx-auto"
          >
            <X size={12} /> 파일 취소
          </button>
        ) : (
          <p className="text-slate-400 text-sm mt-1">
            클릭하거나 파일을 이 곳으로 드래그하세요
          </p>
        )}
      </label>
    </div>
  );
}
