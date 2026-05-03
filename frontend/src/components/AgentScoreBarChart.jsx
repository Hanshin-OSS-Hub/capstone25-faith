import React, { useMemo } from "react";
import { CircleHelp } from "lucide-react";
import { buildAgentScoreRows } from "../lib/resultAgentSummary.js";

const AGENT_SCORE_HELP =
  "각 모델이 산출한 위험도(0~100%)입니다. 막대 색은 모델만 구분하는 용도이며, 오른쪽 카테고리 도넛 색과는 무관합니다.";

function barFillByAgent(agentKey) {
  switch (agentKey) {
    case "gemini":
      return "bg-blue-600 dark:bg-blue-500";
    case "groq":
      return "bg-violet-600 dark:bg-violet-500";
    case "hf":
      return "bg-teal-600 dark:bg-teal-500";
    default:
      return "bg-slate-500 dark:bg-slate-400";
  }
}

export default function AgentScoreBarChart({ result }) {
  const rows = useMemo(
    () => buildAgentScoreRows(result?.agents),
    [result?.agents],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-600 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
          AI 에이전트별 점수
        </h3>
        <div className="group relative inline-flex shrink-0 items-center">
          <button
            type="button"
            className="rounded-full p-0.5 text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-1 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            aria-label="AI 에이전트별 점수 설명 보기"
            aria-describedby="faith-agent-bar-help"
          >
            <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
          <div
            id="faith-agent-bar-help"
            role="tooltip"
            className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2.5rem))] -translate-x-1/2 opacity-0 shadow-lg transition duration-150 ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:w-80"
          >
            <div className="relative rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[11px] font-medium leading-snug text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <div
                className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
                aria-hidden
              />
              <p className="relative whitespace-normal">{AGENT_SCORE_HELP}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex min-w-0 flex-col items-center gap-2 text-center"
          >
            <span className="min-h-[2.5rem] text-xs font-black leading-tight text-slate-600 dark:text-slate-400 sm:text-sm">
              {!row.skipped && row.score != null ? `${row.score}%` : "분석 제외"}
            </span>
            <div className="flex h-32 w-full max-w-[4.5rem] flex-col justify-end sm:h-40 sm:max-w-[5.5rem]">
              <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700/80">
                {row.skipped || row.score == null ? (
                  <div
                    className="absolute inset-0 rounded-lg bg-slate-300 dark:bg-slate-600"
                    aria-hidden
                  />
                ) : (
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-lg transition-[height] duration-500 ${barFillByAgent(row.key)}`}
                    style={{ height: `${row.score}%` }}
                  />
                )}
              </div>
            </div>
            <span className="text-[11px] font-bold leading-tight text-slate-700 dark:text-slate-200 sm:text-xs">
              {row.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
