import React, { useMemo, useRef, useState } from "react";
import { ShieldCheck, Zap } from "lucide-react";
import UploadFile from "../components/UploadFile";
import TextInput from "../components/TextInput";
import CategoryArchive from "../components/CategoryArchive";
import { getAnalyzeError } from "../lib/validators";
import { analyzeText, analyzeMedia } from "../lib/analyze";

import { Link, useNavigate } from "react-router-dom";
import { isLoggedIn } from "../lib/auth";

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

  const handleAnalyze = async () => {
    if (isComposing || isAnalyzing) return;

    const currentText = (textareaRef.current?.value ?? "").trim();

    const error = getAnalyzeError({ text: currentText, file: selectedFile });
    if (error) {
      onError?.(error.title, error.message);
      return;
    }

    setIsAnalyzing(true);
    try {
      let result;
      if (selectedFile) {
        result = await analyzeMedia({ file: selectedFile, description: currentText });
      } else {
        result = await analyzeText({ content: currentText });
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
      onError?.(
        "검증 실패",
        err?.message || "서버와 통신 중 문제가 발생했습니다.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-20">
      {/* 헤더 섹션 */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black tracking-widest uppercase">
          <Zap size={14} className="fill-blue-600" />
          Next-Gen AI Fact Checker
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">
          진실을 분별하는 <span className="text-blue-600">AI의 눈</span>
        </h1>

        <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
          리스크 스코어 엔진을 통해 텍스트와 미디어의 신뢰성을 실시간
          검증합니다.
          <br />
          이미지를 업로드하거나 텍스트를 입력해 보세요.
        </p>
      </div>

      {/* 메인 검증 카드 */}
      <div className="max-w-3xl mx-auto bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/50 border border-slate-100 p-8 md:p-12 space-y-8">
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

        {isAnalyzing && (
          <p className="text-center text-sm font-bold text-slate-400">
            검증이 끝날 때까지 입력과 파일 변경이 잠시 잠깁니다.
          </p>
        )}

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyzeNow || isComposing || isAnalyzing}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 shadow-lg transform active:scale-[0.98]
            ${
              canAnalyzeNow && !isComposing && !isAnalyzing
                ? "bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1 shadow-blue-200"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
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
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100 shadow-sm text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <ShieldCheck size={14} className="text-blue-500" />
          <span>AI 기반 신뢰성 검증</span>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
