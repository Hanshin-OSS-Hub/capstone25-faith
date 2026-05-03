import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Sparkles,
  Brain,
  FileSearch,
  Archive,
  ChevronRight,
  ArrowRight,
  Eye,
  Scale,
  GitMerge,
  AlertTriangle,
  Cpu,
  FlaskConical,
  Workflow,
  BarChart3,
  MessageSquareQuote,
} from "lucide-react";

// ─────────────────────────────────────────
//  데이터
// ─────────────────────────────────────────
const features = [
  {
    icon: Brain,
    title: "멀티 AI 검증",
    desc: "여러 AI 모델이 텍스트·이미지를 함께 분석해 편향을 줄이고, 딥페이크·허위 정보도 교차 검토합니다.",
    accent: "from-violet-500/10 to-blue-500/10",
    ring: "ring-violet-200/60",
  },
  {
    icon: FileSearch,
    title: "리스크 리포트",
    desc: "점수만이 아니라 카테고리·근거·권장 조치까지 한눈에 보이도록 정리된 상세 리포트를 제공합니다.",
    accent: "from-blue-500/10 to-cyan-500/10",
    ring: "ring-blue-200/60",
  },
  {
    icon: Archive,
    title: "아카이브 & 공유",
    desc: "검증 결과를 저장하고, MY·찜으로 모아 보거나 링크로 공유해 팀과 근거를 나눌 수 있습니다.",
    accent: "from-cyan-500/10 to-emerald-500/10",
    ring: "ring-cyan-200/60",
  },
];

const steps = [
  {
    step: "01",
    title: "입력",
    lines: [
      "텍스트를 입력하거나 이미지·파일을 업로드해",
      "검증할 콘텐츠를 준비합니다.",
    ],
  },
  {
    step: "02",
    title: "AI 분석",
    lines: [
      "딥페이크·조작 정확, 허위 정보 패턴 등을",
      "엔진이 종합적으로 판독합니다.",
    ],
  },
  {
    step: "03",
    title: "결과·저장",
    lines: [
      "리스크 지수와 판독 근거를 확인하고,",
      "필요하면 아카이브에 보관합니다.",
    ],
  },
];

const values = [
  {
    icon: Eye,
    title: "투명성",
    lines: ["판단 근거를 사용자가 읽을 수 있는", "형태로 제시합니다."],
  },
  {
    icon: Scale,
    title: "균형",
    lines: ["단일 모델에만 의존하지 않고", "여러 관점을 조합합니다."],
  },
  {
    icon: ShieldCheck,
    title: "안전",
    lines: ["디지털 공간에서의 정보 오염 완화를", "목표로 합니다."],
  },
];

// 검증 흐름 3단계
const verifyFlow = [
  {
    icon: Cpu,
    step: "Step 1",
    title: "멀티 엔진 병렬 분석",
    desc: "Gemini, Groq, HuggingFace 세 AI 엔진이 동일 콘텐츠를 동시에 독립적으로 분석합니다. 단일 모델의 편향이나 오류를 서로 보완합니다.",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-slate-950",
    border: "border-violet-100 dark:border-slate-700",
  },
  {
    icon: GitMerge,
    step: "Step 2",
    title: "앙상블 통합",
    desc: "성공한 엔진들의 위험도를 동일 비중으로 평균해 통합 점수를 만듭니다. 한 모델이 전체 판단을 독점하지 않도록 합니다.",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-slate-950",
    border: "border-blue-100 dark:border-slate-700",
  },
  {
    icon: MessageSquareQuote,
    step: "Step 3",
    title: "근거 포함 결과 출력",
    desc: "최종 점수·카테고리와 함께 어떤 엔진이 왜 위험하다고 판단했는지, 근거 문장을 카테고리별로 구조화해 제공합니다.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-slate-950",
    border: "border-emerald-100 dark:border-slate-700",
  },
];

// 위험도 판단 기준 5가지
const riskCriteria = [
  {
    num: "1",
    title: "문맥 위험성",
    desc: "혐오, 폭력, 선동, 성적 표현, 사칭, 피싱 유도 등 사용자에게 직접적인 피해를 줄 수 있는 맥락을 탐지합니다.",
    tag: "text_risk",
    tagColor: "bg-red-50 text-red-600 border-red-100",
  },
  {
    num: "2",
    title: "사실 검증 위험성",
    desc: "검증 가능한 사실 주장인지, 근거가 부족한 주장인지, 왜곡 또는 허위 가능성이 있는지를 구분합니다.",
    tag: "fact_risk",
    tagColor: "bg-amber-50 text-amber-600 border-amber-100",
  },
  {
    num: "3",
    title: "합성·조작 가능성",
    desc: "AI 생성 텍스트, 딥페이크, 합성 이미지 등 디지털 조작 흔적과 비정상적인 생성 패턴을 분석합니다.",
    tag: "synthetic_risk",
    tagColor: "bg-violet-50 text-violet-600 border-violet-100",
  },
  {
    num: "4",
    title: "카테고리별 분류",
    desc: "탐지된 신호를 바탕으로 혐오/폭력, 딥페이크, 금융 사기, 허위정보, 성적 콘텐츠, 정상으로 분류합니다.",
    tag: "classification",
    tagColor: "bg-blue-50 text-blue-600 border-blue-100",
  },
  {
    num: "5",
    title: "사용자 맥락 보정",
    desc: "연령, 로그인 여부, 위험 민감도와 같은 맥락을 반영해 위험도를 보다 현실적으로 조정합니다.",
    tag: "context",
    tagColor: "bg-slate-100 text-slate-600 border-slate-200",
  },
];

// 실제 결과 예시 카드
const resultExample = {
  score: 82,
  level: "HIGH",
  category: "금융 사기",
  reasons: [
    {
      engine: "Gemini",
      score: 88,
      reason:
        "검증되지 않은 수익 보장 표현과 외부 링크 유도 패턴이 탐지되었습니다. 전형적인 피싱 문구 구조를 포함하고 있습니다.",
    },
    {
      engine: "Groq",
      score: 79,
      reason:
        "비정상적인 투자 수익률 주장과 즉각적 행동 촉구 문구가 금융 사기 패턴과 일치합니다.",
    },
    {
      engine: "HuggingFace",
      score: 71,
      reason:
        "공식 기관 사칭 및 긴급성 강조 표현이 사기 유형 콘텐츠에서 자주 관측되는 특성입니다.",
    },
  ],
};

// ─────────────────────────────────────────
//  훅: 뷰포트 진입 시 fade-in
// ─────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ─────────────────────────────────────────
//  서브 컴포넌트: 리스크 레벨 배지
// ─────────────────────────────────────────
const LevelBadge = ({ level }) => {
  const map = {
    LOW: "bg-emerald-100 text-emerald-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    HIGH: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${map[level]}`}>
      {level}
    </span>
  );
};

// ─────────────────────────────────────────
//  서브 컴포넌트: 결과 예시 카드 (인터랙티브 탭)
// ─────────────────────────────────────────
const ResultExampleCard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const pct = resultExample.score;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
      {/* 상단 점수 헤더 */}
      <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-5 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Risk Score
            </p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-black tabular-nums text-slate-900 dark:text-slate-50">
                {pct}
              </span>
              <span className="mb-1 text-sm font-bold text-slate-400 dark:text-slate-500">/ 100</span>
              <LevelBadge level={resultExample.level} />
            </div>
          </div>
          <div className="text-right">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Category
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-1.5 text-sm font-black text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
              <AlertTriangle size={13} strokeWidth={2.5} />
              {resultExample.category}
            </span>
          </div>
        </div>
        {/* 점수 게이지 바 */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-bold tabular-nums text-slate-300 dark:text-slate-600">
            <span>0</span>
            <span>34 · MEDIUM</span>
            <span>50 · HIGH</span>
            <span>67 · CRITICAL</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* 근거 탭 */}
      <div className="px-6 py-5">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Engine Reasons
        </p>
        {/* 탭 버튼 */}
        <div className="mb-4 flex gap-2">
          {resultExample.reasons.map((r, i) => (
            <button
              key={r.engine}
              onClick={() => setActiveTab(i)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                activeTab === i
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {r.engine}
            </button>
          ))}
        </div>
        {/* 탭 내용 */}
        {resultExample.reasons.map((r, i) => (
          <div
            key={r.engine}
            className={`transition-all duration-200 ${activeTab === i ? "block" : "hidden"}`}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                Score: <span className="text-slate-800 dark:text-slate-200">{r.score}</span> / 100
              </span>
            </div>
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              📌 {r.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
//  메인 컴포넌트
// ─────────────────────────────────────────
const AboutView = () => {
  const [verifyRef, verifyVisible] = useInView();
  const [criteriaRef, criteriaVisible] = useInView();
  const [resultRef, resultVisible] = useInView();

  return (
    <div className="-mx-6 -mb-12 -mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700 dark:text-slate-200">

      {/* ── Hero ── */}
      <section className="relative left-1/2 flex min-h-[calc(100dvh-5rem)] w-screen max-w-none -translate-x-1/2 flex-col justify-center bg-white px-6 py-16 dark:bg-slate-950 md:px-14 md:py-20">
        <div className="relative mx-auto w-full max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300">
            <Sparkles size={14} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
            Fact · AI · Truth · Humanity
          </div>
          <h1 className="mb-6 text-4xl font-black leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50 md:text-5xl lg:text-6xl">
            진실을 향한
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-violet-600 bg-clip-text text-transparent">
              FAITH
            </span>
            <span className="text-slate-800 dark:text-slate-200"> 플랫폼</span>
          </h1>
          <p className="mx-auto max-w-2xl text-pretty text-base font-medium leading-relaxed text-slate-600 break-keep dark:text-slate-400 md:text-lg">
            <span className="block">
              FAITH(페이스)는 인공지능으로 딥페이크·허위·조작 정보를 투명하게 검증하고,
            </span>
            <span className="block">
              신뢰할 수 있는 정보 소비를 돕기 위한{" "}
              <strong className="font-bold text-slate-800 dark:text-slate-200">팩트체크</strong>{" "}
              서비스입니다.
            </span>
          </p>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="mx-auto mt-16 max-w-6xl px-6 md:mt-24">
        <div className="mb-10 text-center md:mb-14">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            Features
          </p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 md:text-4xl">
            <span className="text-blue-600 dark:text-blue-400">FAITH</span>가 제공하는 것
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, desc, accent, ring }) => (
            <div
              key={title}
              className={`group relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/40 ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30 dark:hover:shadow-blue-900/20 ${ring}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0`} aria-hidden />
              <div className="relative">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200/50 transition-transform duration-300 group-hover:scale-105 dark:shadow-blue-900/40">
                  <Icon size={28} strokeWidth={2} />
                </div>
                <h3 className="mb-3 text-xl font-black text-slate-900 dark:text-slate-50">{title}</h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative left-1/2 mt-16 w-screen max-w-none -translate-x-1/2 border-y border-slate-100 bg-white py-16 dark:border-slate-800 dark:bg-slate-950 md:mt-24 md:py-20">
        <div className="mx-auto max-w-6xl px-6 md:px-14">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16 xl:gap-24">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">
                How it works
              </p>
              <h2 className="text-3xl font-black leading-tight text-slate-900 dark:text-white md:text-4xl">
                검증은 이렇게
                <br />
                <span className="text-blue-600 dark:text-blue-400">세 단계</span>로 진행됩니다
              </h2>
            </div>
            <ul className="space-y-10 text-left lg:border-l lg:border-slate-200 lg:pl-6 dark:lg:border-slate-700 xl:pl-8">
              {steps.map((item) => (
                <li key={item.step} className="flex gap-4 sm:gap-5">
                  <span className="shrink-0 text-3xl font-black leading-none text-blue-600 tabular-nums dark:text-blue-400" aria-hidden>
                    {item.step}
                  </span>
                  <div className="min-w-0">
                    <h3 className="mb-2 text-lg font-black text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="max-w-md text-pretty text-sm font-medium leading-relaxed text-slate-600 break-keep dark:text-white">
                      {item.lines.map((line, i) => (
                        <span key={i} className="block">{line}</span>
                      ))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          NEW ① — How FAITH Verifies Risk (검증 방식)
      ══════════════════════════════════════════ */}
      <section
        ref={verifyRef}
        className="mx-auto mt-16 max-w-6xl px-6 md:mt-24"
      >
        {/* 섹션 헤더 */}
        <div className="mb-12 md:mb-16">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            How FAITH Verifies Risk
          </p>
          <h2 className="mb-4 text-3xl font-black leading-tight text-slate-900 dark:text-slate-50 md:text-4xl">
            결과에는 <span className="text-blue-600 dark:text-blue-400">기준</span>이 있습니다
          </h2>
          <p className="max-w-2xl text-pretty text-sm font-medium leading-relaxed text-slate-600 break-keep dark:text-slate-400 md:text-base">
            FAITH의 리스크 평가는 단순 키워드 탐지가 아닙니다.
            콘텐츠 안의 표현, 사실 주장 여부, 조작 가능성, 그리고 맥락 정보를 함께 분석해
            왜 위험하다고 판단했는지 설명 가능한 방식으로 결과를 제공합니다.
          </p>
        </div>

        {/* 검증 흐름 3단계 카드 */}
        <div
          className={`grid gap-4 md:grid-cols-3 transition-all duration-700 ${
            verifyVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {verifyFlow.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className={`relative rounded-[1.75rem] border ${item.border} ${item.bg} p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/60 dark:hover:border-slate-600 dark:hover:shadow-black/25`}
                style={{ transitionDelay: `${idx * 80}ms` }}
              >
                {/* 연결선 화살표 (마지막 제외) */}
                {idx < verifyFlow.length - 1 && (
                  <div className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 md:flex">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800">
                      <ChevronRight size={11} className="text-slate-400 dark:text-slate-500" strokeWidth={2.5} />
                    </div>
                  </div>
                )}
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-800 ${item.color}`}>
                  <Icon size={22} strokeWidth={2} />
                </div>
                <p className={`mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${item.color}`}>
                  {item.step}
                </p>
                <h3 className="mb-3 text-base font-black text-slate-900 dark:text-slate-50">{item.title}</h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          NEW ② — 위험도 판단 기준 5가지
      ══════════════════════════════════════════ */}
      <section
        ref={criteriaRef}
        className="relative left-1/2 mt-16 w-screen max-w-none -translate-x-1/2 border-y border-slate-100 bg-white py-16 dark:border-slate-800 dark:bg-slate-950 md:mt-24 md:py-20"
      >
        <div className="mx-auto max-w-6xl px-6 md:px-14">
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Risk Criteria
            </p>
            <h2 className="mb-4 text-3xl font-black text-slate-900 dark:text-slate-50 md:text-4xl">
              위험도 <span className="text-blue-600 dark:text-blue-400">판단 기준</span>
            </h2>
            <p className="mx-auto max-w-xl text-sm font-medium text-slate-500 break-keep dark:text-slate-400">
              다음 5가지 축을 동시에 분석하고, 엔진별 결과를 앙상블로 합산해 최종 점수를 산출합니다.
            </p>
          </div>

          {/* 통합 흐름 요약 — 카드 그리드 위 */}
          <div
            className={`mb-10 flex flex-wrap items-center justify-center gap-x-1 gap-y-3 px-2 md:mb-12 transition-all duration-700 ${
              criteriaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {["text_risk", "fact_risk", "synthetic_risk"].map((tag, i) => (
              <React.Fragment key={tag}>
                <span className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-blue-900 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-200">
                  {tag}
                </span>
                {i < 2 && (
                  <span className="px-0.5 text-2xl font-black leading-none text-blue-600 dark:text-blue-400" aria-hidden>
                    +
                  </span>
                )}
              </React.Fragment>
            ))}
            <ArrowRight
              className="mx-1 shrink-0 text-slate-400 dark:text-slate-500"
              size={28}
              strokeWidth={2.75}
              aria-hidden
            />
            <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-300">
              weighted ensemble
            </span>
            <ArrowRight
              className="mx-1 shrink-0 text-slate-400 dark:text-slate-500"
              size={28}
              strokeWidth={2.75}
              aria-hidden
            />
            <span className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white dark:border-slate-600 dark:bg-slate-800">
              risk_score 0–100
            </span>
          </div>

          <div
            className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 transition-all duration-700 ${
              criteriaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {riskCriteria.map((item, idx) => {
              const isLast = idx === riskCriteria.length - 1;
              return (
                <div
                  key={item.num}
                  className={`rounded-[1.75rem] border border-slate-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-950 dark:hover:shadow-black/30 ${
                    isLast ? "md:col-span-2 xl:col-span-1" : ""
                  }`}
                  style={{ transitionDelay: `${idx * 60}ms` }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-2xl font-black text-slate-200 tabular-nums leading-none">
                      {item.num}
                    </span>
                    <span className={`ml-auto rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${item.tagColor}`}>
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="mb-2.5 text-base font-black text-slate-900 dark:text-slate-50">{item.title}</h3>
                  <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          NEW ③ — 결과가 제공되는 방식 (실제 예시 카드)
      ══════════════════════════════════════════ */}
      <section
        ref={resultRef}
        className="mx-auto mt-16 max-w-6xl px-6 md:mt-24"
      >
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* 왼쪽: 설명 */}
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              Result Structure
            </p>
            <h2 className="mb-4 text-2xl font-black leading-tight text-slate-900 dark:text-slate-50 md:text-3xl">
              결과는 <span className="text-blue-600 dark:text-blue-400">점수 하나</span>로
              <br />끝나지 않습니다
            </h2>
            <p className="mb-6 text-xs font-medium leading-relaxed text-slate-600 break-keep dark:text-slate-400 md:text-sm">
              FAITH는 위험 점수와 함께 어떤 카테고리로 판단했는지,
              어떤 엔진이 어떤 근거로 그 결과를 만들었는지를
              구조적으로 제공합니다.
            </p>
            <ul className="space-y-2.5">
              {[
                { icon: BarChart3, text: "리스크 점수 (0 – 100) + 위험 레벨 (LOW / MEDIUM / HIGH / CRITICAL)" },
                { icon: Workflow, text: "카테고리 분류 — 혐오/폭력, 딥페이크, 금융 사기, 허위정보, 성적 콘텐츠, 정상" },
                { icon: MessageSquareQuote, text: "엔진별 근거 문장 — Gemini, Groq, HuggingFace 각각의 판단 이유" },
                { icon: FlaskConical, text: "가중치 앙상블 최종 스코어 산출 과정 투명 공개" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/60">
                    <Icon size={11} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-slate-700 break-keep dark:text-slate-300 md:text-[13px]">{text}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* 오른쪽: 실제 결과 예시 카드 */}
          <div
            className={`transition-all duration-700 ${
              resultVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Result Preview — 실제 결과 형태 예시
              </p>
            </div>
            <ResultExampleCard />
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="mx-auto mt-16 max-w-6xl px-6 md:mt-24">
        <div className="mb-10 text-center md:mb-12">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            Values
          </p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 md:text-4xl">
            지향하는 가치
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {values.map(({ icon: Icon, title, lines }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center transition-colors hover:border-blue-500/60 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500/50 dark:hover:bg-slate-800/80"
            >
              <Icon className="mx-auto mb-4 h-10 w-10 text-blue-600 dark:text-blue-400" strokeWidth={2} />
              <h3 className="mb-3 text-lg font-black text-slate-900 dark:text-slate-50">{title}</h3>
              <p className="mx-auto max-w-[16rem] text-pretty text-sm font-medium leading-relaxed text-slate-600 break-keep dark:text-slate-400 sm:max-w-none">
                {lines.map((line, i) => (
                  <span key={i} className="block">{line}</span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative left-1/2 mt-16 w-screen max-w-none -translate-x-1/2 bg-white px-6 py-12 dark:bg-slate-950 md:mt-24 md:px-14 md:py-16">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="mb-3 text-2xl font-black text-slate-900 dark:text-slate-50 md:text-3xl">
            지금 바로 콘텐츠를 검증해 보세요
          </h2>
          <p className="mb-8 text-pretty text-sm font-medium leading-relaxed text-slate-600 break-keep dark:text-slate-400 md:text-base">
            <span className="block">텍스트 한 줄이나 이미지 한 장으로도</span>
            <span className="block">시작할 수 있습니다.</span>
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-10 py-4 text-sm font-black text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.98]"
          >
            검증하기
            <ChevronRight size={20} strokeWidth={2.5} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default AboutView;
