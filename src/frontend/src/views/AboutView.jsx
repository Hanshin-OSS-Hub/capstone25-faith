import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Sparkles,
  Brain,
  FileSearch,
  Archive,
  ChevronRight,
  Zap,
  Eye,
  Scale,
} from "lucide-react";

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
    lines: [
      "판단 근거를 사용자가 읽을 수 있는",
      "형태로 제시합니다.",
    ],
  },
  {
    icon: Scale,
    title: "균형",
    lines: [
      "단일 모델에만 의존하지 않고",
      "여러 관점을 조합합니다.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "안전",
    lines: [
      "디지털 공간에서의 정보 오염 완화를",
      "목표로 합니다.",
    ],
  },
];

const AboutView = () => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 -mx-6 -mt-12 -mb-12">
      {/* Hero — 풀뷰포트 높이·흰 배경, 스크롤 전 아래 섹션 비노출 */}
      <section className="relative left-1/2 flex min-h-[calc(100dvh-5rem)] w-screen max-w-none -translate-x-1/2 flex-col justify-center bg-white px-6 py-16 md:px-14 md:py-20">
        <div className="relative mx-auto w-full max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-blue-700">
            <Sparkles size={14} className="text-blue-600" strokeWidth={2.5} />
            Fact·AI·Truth·Humanity
          </div>
          <h1 className="mb-6 text-4xl font-black leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            진실을 향한
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-violet-600 bg-clip-text text-transparent">
              FAITH
            </span>
            <span className="text-slate-800"> 플랫폼</span>
          </h1>
          <p className="mx-auto max-w-2xl text-pretty text-base font-medium leading-relaxed text-slate-600 break-keep md:text-lg">
            <span className="block">
              FAITH(페이스)는 인공지능으로 딥페이크·허위·조작 정보를 투명하게
              검증하고,
            </span>
            <span className="block">
              신뢰할 수 있는 정보 소비를 돕기 위한{" "}
              <strong className="font-bold text-slate-800">팩트체크</strong>{" "}
              서비스입니다.
            </span>
          </p>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto mt-16 max-w-6xl px-6 md:mt-24">
        <div className="mb-10 text-center md:mb-14">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            Features
          </p>
          <h2 className="text-3xl font-black text-slate-900 md:text-4xl">
            <span className="text-blue-600">FAITH</span>가 제공하는 것
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, desc, accent, ring }) => (
            <div
              key={title}
              className={`group relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/40 ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/50 ${ring}`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0`}
                aria-hidden
              />
              <div className="relative">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200/50 transition-transform duration-300 group-hover:scale-105">
                  <Icon size={28} strokeWidth={2} />
                </div>
                <h3 className="mb-3 text-xl font-black text-slate-900">
                  {title}
                </h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — 뷰포트 전체 너비 흰 배경 (카드/남색 없음) */}
      <section className="relative left-1/2 mt-16 w-screen max-w-none -translate-x-1/2 border-y border-slate-100 bg-white py-16 md:mt-24 md:py-20">
        <div className="mx-auto max-w-6xl px-6 md:px-14">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16 xl:gap-24">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-blue-600">
                How it works
              </p>
              <h2 className="text-3xl font-black leading-tight text-slate-900 md:text-4xl">
                검증은 이렇게
                <br />
                <span className="text-blue-600">세 단계</span>로 진행됩니다
              </h2>
            </div>
            <ul className="space-y-10 text-left lg:border-l lg:border-slate-200 lg:pl-6 xl:pl-8">
              {steps.map((item) => (
                <li key={item.step} className="flex gap-4 sm:gap-5">
                  <span
                    className="shrink-0 text-3xl font-black leading-none text-blue-600 tabular-nums"
                    aria-hidden
                  >
                    {item.step}
                  </span>
                  <div className="min-w-0">
                    <h3 className="mb-2 text-lg font-black text-slate-900">
                      {item.title}
                    </h3>
                    <p className="max-w-md text-pretty text-sm font-medium leading-relaxed text-slate-600 break-keep">
                      {item.lines.map((line, i) => (
                        <span key={i} className="block">
                          {line}
                        </span>
                      ))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto mt-16 max-w-6xl md:mt-24">
        <div className="mb-10 text-center md:mb-12">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            Values
          </p>
          <h2 className="text-3xl font-black text-slate-900 md:text-4xl">
            지향하는 가치
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {values.map(({ icon: Icon, title, lines }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center transition-colors hover:border-blue-500/60 hover:bg-white"
            >
              <Icon
                className="mx-auto mb-4 h-10 w-10 text-blue-600"
                strokeWidth={2}
              />
              <h3 className="mb-3 text-lg font-black text-slate-900">
                {title}
              </h3>
              <p className="mx-auto max-w-[16rem] text-pretty text-sm font-medium leading-relaxed text-slate-600 break-keep sm:max-w-none">
                {lines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA — 풀뷰포트 높이·흰 배경 (카드 없음) */}
      <section className="relative left-1/2 mt-16 w-screen max-w-none -translate-x-1/2 bg-white px-6 py-12 md:mt-24 md:px-14 md:py-16">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="mb-3 text-2xl font-black text-slate-900 md:text-3xl">
            지금 바로 콘텐츠를 검증해 보세요
          </h2>
          <p className="mb-8 text-pretty text-sm font-medium leading-relaxed text-slate-600 break-keep md:text-base">
            <span className="block">텍스트 한 줄이나 이미지 한 장으로도</span>
            <span className="block">시작할 수 있습니다.</span>
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-10 py-4 text-sm font-black text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.98]"
          >
            홈으로 이동
            <ChevronRight size={20} strokeWidth={2.5} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default AboutView;
