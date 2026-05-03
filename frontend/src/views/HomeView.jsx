import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck, X, Zap } from "lucide-react";
import UploadFile from "../components/UploadFile";
import TextInput from "../components/TextInput";
import CategoryArchive from "../components/CategoryArchive";
import { getAnalyzeError } from "../lib/validators";
import { analyzeText, analyzeMedia } from "../lib/analyze";
import { fetchMasUserContext } from "../lib/masUserContext";

import { Link, useNavigate } from "react-router-dom";

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    fr.readAsDataURL(file);
  });
}

const HomeView = ({ onError }) => {
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const analyzeAbortRef = useRef(null);

  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const trimmedText = useMemo(() => textContent.trim(), [textContent]);
  const textLength = trimmedText.length;

  const canAnalyzeNow = useMemo(
    () => !!selectedFile || textLength >= 5,
    [selectedFile, textLength],
  );

  useEffect(() => {
    if (!isAnalyzing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isAnalyzing]);

  const handleAnalyze = async () => {
    if (isComposing || isAnalyzing) return;

    const currentText = (textareaRef.current?.value ?? "").trim();

    const error = getAnalyzeError({ text: currentText, file: selectedFile });
    if (error) {
      onError?.(error.title, error.message);
      return;
    }

    const ac = new AbortController();
    analyzeAbortRef.current = ac;
    setIsAnalyzing(true);
    try {
      const masUser = await fetchMasUserContext();
      let result;
      if (selectedFile) {
        result = await analyzeMedia({
          file: selectedFile,
          description: currentText,
          signal: ac.signal,
          masUser,
        });
      } else {
        result = await analyzeText({
          content: currentText,
          signal: ac.signal,
          masUser,
        });
      }

      let sourceImageDataUrl = null;
      let sourceFileHint = null;
      if (selectedFile) {
        if (selectedFile.type.startsWith("image/")) {
          try {
            sourceImageDataUrl = await readFileAsDataURL(selectedFile);
          } catch {
            sourceFileHint = selectedFile.name || "이미지";
          }
        } else {
          sourceFileHint = selectedFile.name || "첨부 파일";
        }
      }

      navigate("/result", {
        state: {
          result,
          sourceText: currentText || null,
          sourceImageDataUrl,
          sourceFileHint,
        },
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      onError?.(
        "검증 실패",
        err?.message || "서버와 통신 중 문제가 발생했습니다.",
      );
    } finally {
      analyzeAbortRef.current = null;
      setIsAnalyzing(false);
    }
  };

  const handleCancelVerify = () => {
    analyzeAbortRef.current?.abort();
  };

  return (
    <div className="animate-fade-in space-y-20">
      {/* 헤더 섹션 */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          <Zap size={14} className="fill-blue-600" />
          Next-Gen AI Fact Checker
        </div>

        <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-slate-50 md:text-6xl">
          진실을 분별하는 <span className="text-blue-600 dark:text-blue-400">AI의 눈</span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg font-medium text-slate-500 dark:text-slate-400">
          리스크 스코어 엔진을 통해 텍스트와 미디어의 신뢰성을 실시간
          검증합니다.
          <br />
          이미지를 업로드하거나 텍스트를 입력해 보세요.
        </p>
      </div>

      {/* 메인 검증 카드 */}
      <div className="mx-auto max-w-3xl space-y-8 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-2xl shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50 md:p-12">
        <UploadFile
          selectedFile={selectedFile}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onFileSelected={(f) => setSelectedFile(f)}
          onClearFile={() => setSelectedFile(null)}
          inputId="fileInput"
          disabled={isAnalyzing}
        />

        <TextInput
          textareaRef={textareaRef}
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          textLength={textLength}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(e) => {
            setIsComposing(false);
            setTextContent(e.target.value);
          }}
          disabled={isAnalyzing}
        />

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyzeNow || isComposing || isAnalyzing}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 shadow-lg transform active:scale-[0.98]
            ${
              canAnalyzeNow && !isComposing && !isAnalyzing
                ? "bg-blue-600 text-white shadow-blue-200 hover:-translate-y-1 hover:bg-blue-700 dark:bg-blue-500 dark:shadow-none dark:hover:bg-blue-600"
                : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            }`}
        >
          <Zap
            size={22}
            fill={canAnalyzeNow && !isComposing && !isAnalyzing ? "white" : "none"}
          />
          {isAnalyzing ? "검증 중..." : "검증 시작하기"}
        </button>
      </div>

      {/* 카테고리 아카이브 */}
      <CategoryArchive
        onTitleClick={() => navigate("/archive/all/1")}
        onViewAll={() => navigate("/archive/all/1")}
        onCategoryClick={({ slug }) =>
          navigate(`/archive/${slug ?? "all"}/1`)
        }
      />

      {/* 하단 뱃지 안내 */}
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <ShieldCheck size={14} className="text-blue-500" />
          <span>AI 기반 신뢰성 검증</span>
        </div>
      </div>

      {isAnalyzing ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-[2px]"
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-labelledby="faith-verify-loading-title"
        >
          <div className="relative rounded-3xl border border-slate-100 bg-white px-14 py-12 pt-11 shadow-xl shadow-slate-900/10 dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40">
            <button
              type="button"
              onClick={handleCancelVerify}
              className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="검증 취소"
            >
              <X className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <Loader2 className="h-9 w-9 animate-spin" strokeWidth={2.2} />
              </div>
              <h2
                id="faith-verify-loading-title"
                className="mt-5 text-lg font-black tracking-tight text-slate-900 dark:text-slate-50"
              >
                검증 중입니다
              </h2>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HomeView;
