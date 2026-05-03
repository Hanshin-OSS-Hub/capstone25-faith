import React from 'react';
import { ShieldCheck } from 'lucide-react';

const AboutView = () => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-24 py-8">
      {/* Intro */}
      <div className="text-center max-w-3xl mx-auto">
        <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-widest mb-6 inline-block">Our Mission</span>
        <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">
          Fact, AI, Truth, and Humanity:<br/>
          <span className="text-blue-600">FAITH</span> 플랫폼
        </h2>
        <p className="text-lg text-slate-600 leading-relaxed">
          FAITH(페이스)는 인공지능 기술을 활용하여 딥페이크와 허위 조작 정보를 투명하게 검증하고, 
          신뢰할 수 있는 정보를 제공 및 정보오염을 방지하기 위해 개발된 팩트체크 플랫폼입니다.
        </p>
      </div>

      {/* How it Works (검은색 섹션 복구) */}
      <div className="bg-slate-900 rounded-[3rem] p-12 md:p-20 text-white shadow-2xl overflow-hidden relative">
        <div className="relative z-10 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h3 className="text-3xl font-black mb-12 italic text-blue-400">"How FAITH Works"</h3>
            <div className="space-y-12">
              {[
                { step: "01", title: "미디어 데이터 수집", desc: "URL 또는 파일 업로드를 통해 이미지/동영상/뉴스 데이터 확보" },
                { step: "02", title: "AI 멀티 모델 분석", desc: "딥페이크, 변조 패턴, 메타데이터 조작 여부 정밀 탐지" },
                { step: "03", title: "리스크 리포트 생성", desc: "사용자가 이해하기 쉬운 리스크 스코어와 판독 근거 제공" }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <span className="text-4xl font-black text-blue-500/30 leading-none">{item.step}</span>
                  <div>
                    <h5 className="text-xl font-bold mb-2">{item.title}</h5>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/5 rounded-3xl p-12 border border-white/10 text-center flex flex-col items-center justify-center">
             <ShieldCheck className="w-24 h-24 text-blue-500 mb-6 opacity-60" />
             <div className="text-2xl font-bold mb-2">Safe Digital Society</div>
             <p className="text-slate-500 text-sm">한신대학교 캡스톤디자인 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutView;