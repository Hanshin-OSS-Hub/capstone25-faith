import React, { useState } from 'react';
import { Upload, Globe, ChevronRight, Loader2, AlertTriangle, Info, AlignLeft, Zap, CheckCircle } from 'lucide-react';

/**
 * 리스크 지수 시각화 컴포넌트
 */
const RiskChart = ({ score }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - score * circumference;

  const getColor = (s) => {
    if (s <= 0.25) return '#10b981';
    if (s <= 0.50) return '#f59e0b';
    return '#ef4444';
  };

  const getLabel = (s) => {
    if (s <= 0.25) return 'Low';
    if (s <= 0.50) return 'Moderate';
    return 'Critical';
  };

  const color = getColor(score);

  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="96" cy="96" r={radius} stroke="#e5e7eb" strokeWidth="12" fill="transparent" />
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black" style={{ color }}>
          {(score * 100).toFixed(0)}%
        </span>
        <span className="text-sm font-bold uppercase tracking-wider mt-1" style={{ color }}>
          {getLabel(score)}
        </span>
      </div>
    </div>
  );
};

// 0~1 score를 등급 라벨로
const labelFromScore01 = (s01) => {
  if (s01 <= 0.25) return "LOW";
  if (s01 <= 0.50) return "MODERATE";
  if (s01 <= 0.75) return "HIGH";
  return "CRITICAL";
};

// 카테고리(한국어) -> Detection 문구(중립적)
const detectionFromCategory = (catKo) => {
  const c = (catKo || "").trim();
  if (c === "정상") return "No Manipulation Detected";
  if (c === "허위정보") return "Synthetic / Manipulated Content";
  if (c === "딥페이크") return "Synthetic / Manipulated Content";
  if (c === "금융 사기") return "Fraud Risk";
  if (c === "혐오/폭력") return "Hate / Violence Risk";
  if (c === "성적 콘텐츠") return "Sexual Content Risk";
  return "Content Risk Detected";
};

const HomeView = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState(null);

  // ✅ 추가: 파일/텍스트 상태
  const [selectedFile, setSelectedFile] = useState(null);
  const [textContent, setTextContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const startVerification = async () => {
    const urlTrim = videoUrl.trim();
    const hasUrl = urlTrim.length > 0;
    const hasFile = !!selectedFile;
    const isVideoFile = selectedFile?.type?.startsWith("video/");
    const hasText = textContent.trim().length >= 5;

    if (hasUrl && hasFile) {
      alert("영상 URL과 파일을 동시에 사용할 수 없습니다. 하나만 선택해주세요.");
      return;
    }

    if (hasUrl && !urlTrim.startsWith("https://")) {
      alert("영상 링크는 https:// 로 시작해야 합니다.");
      return;
    }

    if (hasUrl || isVideoFile) {
      if (hasFile && !isVideoFile) {
        alert("이미지 파일과 영상 URL/영상 파일은 함께 쓸 수 없습니다. 영상만 선택하거나 URL만 입력해주세요.");
        return;
      }
    } else if (!hasFile && !hasText) {
      alert("검증할 텍스트를 5자 이상 입력하거나 파일/영상 URL을 입력해주세요.");
      return;
    }

    setIsAnalyzing(true);

    try {
      let data;
      let degradedMsg = null;

      if (hasUrl || isVideoFile) {
        const formData = new FormData();
        if (hasUrl) formData.append("video_url", urlTrim);
        if (isVideoFile) formData.append("video", selectedFile);
        formData.append("text", textContent || "");

        const res = await fetch("/api/ai/video/media", {
          method: "POST",
          body: formData,
        });
        data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const d = data?.detail;
          const msg =
            (typeof d === "string" ? d : d?.message) ||
            data?.message ||
            `요청 실패 (${res.status})`;
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }

        const final = data?.final || {};
        const score100 = Number(final.risk_score ?? 0);
        const score01 = Math.max(0, Math.min(1, score100 / 100));
        const riskLabel = labelFromScore01(score01);
        const categoryKo = final.risk_category || "정상";
        const reasons = data?.summary?.reason_summary;
        const firstReason =
          Array.isArray(reasons) && reasons.length ? String(reasons[0]) : "";
        const refinedReason = firstReason
          ? `근거(대표 프레임): ${firstReason}`
          : "근거: 샘플링된 프레임 기준으로 위험 신호를 검토했습니다.";

        const keyJudgement = (() => {
          if (riskLabel === "LOW") return "조작 또는 합성 정황은 확인되지 않았습니다.";
          if (riskLabel === "MODERATE") return "합성 또는 조작 가능성이 일부 확인되었습니다.";
          if (riskLabel === "HIGH") return "인위적 합성/조작 정황이 뚜렷하게 확인되었습니다.";
          return "조작 가능성이 매우 높아 즉각적인 주의가 필요합니다.";
        })();

        const actionTip = (() => {
          if (riskLabel === "LOW") return "권장: 추가 조치 없이 확인 수준으로 충분합니다.";
          if (riskLabel === "MODERATE") return "권장: 공유/확산 전 출처를 한 번 더 확인하세요.";
          if (riskLabel === "HIGH") return "권장: 공유를 보류하고, 출처/원본 여부를 확인하세요.";
          return "권장: 공유를 중단하고, 신고/차단 등 즉각적인 대응을 고려하세요.";
        })();

        const detection = detectionFromCategory(categoryKo);
        const confidence = Math.round(Math.max(60, Math.min(99, 60 + score100 * 0.4)));
        const framesN = data?.summary?.analyzed_frame_count;

        setResult({
          score: score01,
          level: `${Math.round(score01 * 100)}%`,
          details: [
            `카테고리: ${categoryKo}`,
            `핵심 판단: ${keyJudgement}`,
            refinedReason,
            actionTip,
            typeof framesN === "number" ? `분석 프레임 수: ${framesN}` : null,
          ].filter(Boolean),
          detection,
          confidence,
          raw: data,
        });
        setShowResult(true);
        return;
      }

      const formData = new FormData();

      if (hasFile) formData.append("image", selectedFile);

      formData.append("text", textContent || "");

      formData.append("member_id", "0");

      const res = await fetch("/api/ai/mas/media", {
        method: "POST",
        body: formData,
      });

      data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.detail?.message ||
          data?.detail ||
          data?.message ||
          `요청 실패 (${res.status})`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      degradedMsg =
        data?.message ||
        data?.detail?.message ||
        (data?.degraded ? "분석이 일부 제한(degraded) 상태로 수행되었습니다." : null);

      const final = data?.final || {};
      const agents = data?.agents || {};

      // 점수/카테고리
      const score100 = Number(final.risk_score ?? 0);      // 0~100
      const score01 = Math.max(0, Math.min(1, score100 / 100));
      const riskLabel = labelFromScore01(score01);
      const categoryKo = final.risk_category || "정상";

      // 에이전트별 raw에서 “근거 후보”만 안전 추출 (AI 이름 노출 X)
      const geminiReason = (() => {
        const g = agents?.gemini;
        const arr = Array.isArray(g?.reasons) ? g.reasons : [];
        return arr[0] || "";
      })();

      const groqReason = (() => {
        const g = agents?.groq;
        return g?.risk_reason || g?.reason || "";
      })();

      // “더 강한 근거 1개” 선택 (점수 높은 쪽 우선)
      const geminiScore100 = Number(agents?.gemini?.risk_score ?? -1);  // gemini는 보통 0~100
      let groqScore100 = Number(agents?.groq?.risk_score ?? -1);        // groq는 0~1 또는 0~100일 수 있음
      if (groqScore100 > -1 && groqScore100 <= 1) groqScore100 *= 100;  // 0~1이면 0~100으로

      const candidates = [
        { score: geminiScore100, reason: geminiReason },
        { score: groqScore100, reason: groqReason },
      ].filter((x) => x.score >= 0 && x.reason && x.reason.trim().length > 0);

      candidates.sort((a, b) => b.score - a.score);
      const rawTopReason = candidates[0]?.reason?.trim() || "";

      // ✅ “서비스형 문구”로 정제 (위험/낮음 같은 단정 제거, 사실 설명 중심)
      const refinedReason = rawTopReason
        ? `근거: ${rawTopReason.replace(/위험도는\s*(낮습니다|높습니다)\.?/g, "").trim()}`
        : "근거: 이미지/텍스트 맥락에서 유의미한 위험 신호가 감지되었습니다.";

      // 핵심 판단(점수대 기반)
      const keyJudgement = (() => {
        if (riskLabel === "LOW") return "조작 또는 합성 정황은 확인되지 않았습니다.";
        if (riskLabel === "MODERATE") return "합성 또는 조작 가능성이 일부 확인되었습니다.";
        if (riskLabel === "HIGH") return "인위적 합성/조작 정황이 뚜렷하게 확인되었습니다.";
        return "조작 가능성이 매우 높아 즉각적인 주의가 필요합니다.";
      })();

      // 권장 행동(선택)
      const actionTip = (() => {
        if (riskLabel === "LOW") return "권장: 추가 조치 없이 확인 수준으로 충분합니다.";
        if (riskLabel === "MODERATE") return "권장: 공유/확산 전 출처를 한 번 더 확인하세요.";
        if (riskLabel === "HIGH") return "권장: 공유를 보류하고, 출처/원본 여부를 확인하세요.";
        return "권장: 공유를 중단하고, 신고/차단 등 즉각적인 대응을 고려하세요.";
      })();

      // Detection/Confidence(기술 티 최소화)
      const detection = detectionFromCategory(categoryKo);

      // confidence는 “판단 신뢰도”로 표시하되, 지금은 간단히 score 기반으로 추정치 제공(원하면 백엔드에서 내려줘도 됨)
      const confidence = Math.round(Math.max(60, Math.min(99, 60 + score100 * 0.4))); // 60~99 범위
      

      setResult({
        score: score01,                // 차트용
        level: `${Math.round(score01 * 100)}%`, // 배지용 (원하면 riskLabel로 바꿔도 됨)

        details: [
          `카테고리: ${categoryKo}`,
          `핵심 판단: ${keyJudgement}`,
          refinedReason,
          actionTip,
          degradedMsg ? `⚠️ ${degradedMsg}` : null,
        ].filter(Boolean),

        detection,   // ✅ UI 카드에 연결
        confidence,  // ✅ UI 카드에 연결
        raw: data,   // 개발용 (표시 안 해도 됨)
      });

      setShowResult(true);
    } catch (err) {
      console.error(err);
      alert(`분석 실패: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isAnalyzing) {
    return (
      <div className="py-24 text-center animate-pulse">
        <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-blue-600">AI 정밀 분석 중...</h2>
        <p className="text-slate-500 mt-2">미디어의 조작 흔적을 탐지하고 있습니다.</p>
      </div>
    );
  }
  
  if (showResult) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col lg:flex-row gap-10 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="lg:w-1/3 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-slate-100 pb-8 lg:pb-0 lg:pr-10">
            <h4 className="font-bold mb-6 text-slate-500 uppercase text-xs tracking-widest">리스크 지수</h4>
            <RiskChart score={result.score} />
            <button
              onClick={() => {
                setShowResult(false);
                setResult(null);
                setSelectedFile(null);
                setTextContent("");
                setVideoUrl("");
              }}
              className="mt-8 w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              다시 검사
            </button>
          </div>

          <div className="lg:w-2/3">
            <div className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-sm font-bold inline-flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4" />
              리스크 수준: {(result.score * 100).toFixed(0)}%
            </div>

            <h2 className="text-3xl font-black mb-6 text-slate-900">분석 상세 리포트</h2>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 font-bold mb-2 text-slate-800">
                <Info className="text-blue-500 w-5 h-5" /> 판독 근거
              </div>
              <div className="text-slate-600 leading-relaxed space-y-2">
                {result.details.map((item, idx) => (
                  <p key={idx}>{item}</p>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <div className="flex-1 p-4 bg-white border border-slate-100 rounded-xl">
                <div className="text-xs text-slate-400 font-bold mb-1 uppercase">Confidence</div>
                <div className="text-lg font-black text-slate-800">{result?.confidence ? `${result.confidence}%` : "-"}</div>
              </div>
              <div className="flex-1 p-4 bg-white border border-slate-100 rounded-xl">
                <div className="text-xs text-slate-400 font-bold mb-1 uppercase">Detection</div>
                <div className="text-lg font-black text-slate-800">{result?.detection || "-"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
          진실을 분별하는 <span className="text-blue-600">AI의 눈</span>
        </h1>
        <p className="text-slate-500 text-lg">미디어·텍스트를 업로드하거나, 유튜브 등 영상 URL(https)을 붙여넣어 조작 여부를 확인하세요.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-12 mb-8 border border-slate-100 relative text-center">
        <label className="block border-2 border-dashed border-slate-100 hover:border-blue-200 rounded-2xl py-10 cursor-pointer transition-all group">
          <input type="file" onChange={handleFileSelect} className="hidden" />
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-all ${
              selectedFile ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
            }`}
          >
            {selectedFile ? <CheckCircle className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
          </div>

          <h3 className="text-xl font-bold text-slate-800">
            {selectedFile ? selectedFile.name : "검증할 파일 업로드"}
          </h3>
          <p className="text-slate-400 mt-2 text-sm">
            {selectedFile ? "파일이 선택되었습니다" : "이미지(JPG, PNG) 또는 영상(MP4) 파일을 클릭해 선택하세요"}
          </p>
        </label>

        <div className="mt-8 text-left">
          <div className="flex items-center gap-2 px-1 mb-3">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Video URL (optional)</span>
          </div>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... 또는 직접 영상 링크 (https만)"
            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 font-medium mb-2"
          />
          <p className="text-xs text-slate-400 mb-6">
            URL을 넣으면 서버에서 영상을 받아 프레임 샘플로 분석합니다. URL과 파일은 동시에 사용할 수 없습니다.
          </p>
          <div className="flex items-center gap-2 px-1 mb-3">
            <AlignLeft className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Text Content</span>
          </div>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="분석할 텍스트 내용을 입력하세요 (최소 5자 이상)..."
            className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-slate-700 font-medium"
          />
        </div>

        {/* 분석 시작 버튼 */}
        <button
          onClick={startVerification}
          className="w-full mt-8 bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
        >
          <Zap className="w-5 h-5" /> 실시간 분석 시작
        </button>
      </div>

      <section>
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">카테고리별 아카이브</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
          {["정치", "경제", "연예", "사회", "기술", "국제"].map((name) => (
            <button
              key={name}
              type="button"
              className="
                bg-white p-6 rounded-2xl border border-slate-200
                transition-colors duration-200
                hover:border-blue-400
                focus:outline-none focus:ring-0
                text-center
              "
            >
              <div className="bg-slate-50 p-3 rounded-xl inline-flex mb-3">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div className="font-bold text-slate-900">{name}</div>
            </button>
          ))}
        </div>

      </section>
    </div>
  );
};

export default HomeView;
