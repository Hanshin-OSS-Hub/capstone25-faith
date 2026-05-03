import React, { useState } from 'react';
import { Upload, Globe, ChevronRight, Loader2, AlertTriangle, Info } from 'lucide-react';

/**
 * 리스크 지수 시각화 컴포넌트 (내부 포함으로 경로 오류 해결)
 */
const RiskChart = ({ score }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - score * circumference;
  
  const getColor = (s) => {
    if (s <= 0.25) return '#10b981'; // Low
    if (s <= 0.50) return '#f59e0b'; // Moderate
    return '#ef4444'; // Critical
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
      <div className="absolute inset-0 flex flex-col items-center justify-center transform rotate-0">
        <span className="text-4xl font-black" style={{ color }}>{(score * 100).toFixed(0)}%</span>
        <span className="text-sm font-bold uppercase tracking-wider mt-1" style={{ color }}>{getLabel(score)}</span>
      </div>
    </div>
  );
};

const HomeView = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);  
      formData.append("text", "");        
      formData.append("member_id", "0"); 

      const res = await fetch("/api/predict/media", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.detail?.message ||
          data?.detail ||
          data?.message ||
          `요청 실패 (${res.status})`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      setResult({
        score: (Number(data.risk_score) || 0) / 100, 
        level: data.risk_level || "LOW",
        details: Array.isArray(data.analysis_details)
          ? data.analysis_details
          : [data.analysis_details || "분석 상세 정보가 없습니다."],
      });

      setShowResult(true);
    } catch (err) {
      console.error(err);
      alert(`분석 실패: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };


  if (isAnalyzing) return (
    <div className="py-24 text-center animate-pulse">
      <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" />
      <h2 className="text-2xl font-bold text-blue-600">AI 정밀 분석 중...</h2>
      <p className="text-slate-500 mt-2">미디어의 조작 흔적을 탐지하고 있습니다.</p>
    </div>
  );

  if (showResult) return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row gap-10 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="lg:w-1/3 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-slate-100 pb-8 lg:pb-0 lg:pr-10">
          <h4 className="font-bold mb-6 text-slate-500 uppercase text-xs tracking-widest">리스크 지수</h4>
          <RiskChart score={result.score} />
          <button onClick={() => setShowResult(false)} className="mt-8 w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors">다시 검사</button>
        </div>
        <div className="lg:w-2/3">
          <div className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-sm font-bold inline-flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4" /> 리스크 수준: {result.level}
          </div>
          <h2 className="text-3xl font-black mb-6 text-slate-900">분석 상세 리포트</h2>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 font-bold mb-2 text-slate-800"><Info className="text-blue-500 w-5 h-5" /> 판독 근거</div>
            <div className="text-slate-600 leading-relaxed space-y-2">
              {result.details.map((item, idx) => (
                <p key={idx}>{item}</p>
              ))}
            </div>
          </div>
          <div className="mt-6 flex gap-3">
              <div className="flex-1 p-4 bg-white border border-slate-100 rounded-xl">
                  <div className="text-xs text-slate-400 font-bold mb-1 uppercase">Confidence</div>
                  <div className="text-lg font-black text-slate-800">94.2%</div>
              </div>
              <div className="flex-1 p-4 bg-white border border-slate-100 rounded-xl">
                  <div className="text-xs text-slate-400 font-bold mb-1 uppercase">Detection</div>
                  <div className="text-lg font-black text-slate-800">Deepfake AI</div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">진실을 분별하는 <span className="text-blue-600">AI의 눈</span></h1>
        <p className="text-slate-500 text-lg">미디어를 업로드하여 조작 여부를 즉시 확인하세요.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-12 mb-16 border-2 border-dashed border-slate-100 hover:border-blue-200 transition-all relative cursor-pointer group text-center">
        <input type="file" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
          <Upload className="w-8 h-8 transition-colors" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">검증할 파일 업로드</h3>
        <p className="text-slate-400 mt-2 text-sm">이미지(JPG, PNG) 또는 영상(MP4) 파일을 드래그하거나 클릭하세요</p>
      </div>

      <section>
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">카테고리별 아카이브</h2>
          <button className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline">
            전체보기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {['정치', '경제', '연예', '사회', '기술', '국제'].map((name) => (
            <div key={name} className="bg-white p-6 rounded-2xl border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all text-center group cursor-pointer">
              <div className="bg-slate-50 p-3 rounded-xl inline-block mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Globe className="w-5 h-5" />
              </div>
              <div className="font-bold text-slate-700">{name}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomeView;