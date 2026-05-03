import React, { useMemo } from "react";
import { CircleHelp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { buildDonutSlices } from "../lib/resultAgentSummary.js";

const CATEGORY_DONUT_HELP =
  "각 모델이 붙인 라벨(허위정보·딥페이크 등)에, 그 모델의 위험도를 가중치로 곱해 합친 비율입니다. 왼쪽 막대 %와 숫자를 맞출 필요는 없고, 색도 왼쪽 모델 색과 대응하지 않습니다.";

const pieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
      {p.name}: {p.value}%
    </div>
  );
};

export default function AgentCategoryDonut({ result }) {
  const pieData = useMemo(
    () => buildDonutSlices(result?.agents, result?.final?.risk_category),
    [result?.agents, result?.final?.risk_category],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-600 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">카테고리 분포</h3>
        <div className="group relative inline-flex shrink-0 items-center">
          <button
            type="button"
            className="rounded-full p-0.5 text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-1 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            aria-label="카테고리 분포 설명 보기"
            aria-describedby="faith-category-donut-help"
          >
            <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
          <div
            id="faith-category-donut-help"
            role="tooltip"
            className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2.5rem))] -translate-x-1/2 opacity-0 shadow-lg transition duration-150 ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:w-80"
          >
            <div className="relative rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[11px] font-medium leading-snug text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <div
                className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
                aria-hidden
              />
              <p className="relative whitespace-normal">{CATEGORY_DONUT_HELP}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 h-[176px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={64}
              paddingAngle={2}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={pieTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
        {pieData.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: s.fill }}
            />
            {s.name} {s.value}%
          </span>
        ))}
      </div>
    </div>
  );
}
