import { useEffect, useState } from "react";
import { Copy, Share2, X } from "lucide-react";

export default function ShareArchiveModal({
  open,
  onClose,
  url,
  shareTitle,
}) {
  const [copied, setCopied] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } else {
        window.prompt("아래 링크를 복사하세요.", url);
      }
    } catch {
      window.prompt("아래 링크를 복사하세요.", url);
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareTitle,
        url,
      });
      onClose();
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-archive-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Share2 className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <h2
              id="share-archive-title"
              className="text-lg font-black text-slate-900 dark:text-slate-50"
            >
              결과 공유
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
          아래 링크를 복사해 카카오톡·문자 등에 붙여넣을 수 있어요.
        </p>
        {shareTitle ? (
          <p className="mb-3 line-clamp-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            {shareTitle}
          </p>
        ) : null}

        <div className="mb-4 flex gap-2">
          <input
            readOnly
            value={url}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-blue-500"
            onFocus={(e) => e.target.select()}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
          >
            <Copy className="h-4 w-4 shrink-0" />
            {copied ? "복사됨" : "링크 복사"}
          </button>
          {canNativeShare ? (
            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:border-blue-200 hover:bg-blue-50/80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:bg-slate-700"
            >
              기기 공유 창
            </button>
          ) : null}
        </div>

        {canNativeShare ? (
          <p className="mt-3 text-xs font-medium leading-relaxed text-slate-400 dark:text-slate-500">
            「기기 공유 창」은 Windows·휴대폰이 제공하는 공유 화면입니다. 앱 안
            공유와 모양이 다를 수 있어요.
          </p>
        ) : null}
      </div>
    </div>
  );
}
