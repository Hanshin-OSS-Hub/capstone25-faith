import React from "react";
import { Globe, ChevronRight } from "lucide-react";

/** 키는 아카이브 라우트 `/archive/:category/:page` 와 동일 */
const DEFAULT_CATEGORIES = {
  all: { label: "전체", icon: Globe },
  enter: { label: "연예", icon: Globe },
  social: { label: "사회", icon: Globe },
  politics: { label: "정치", icon: Globe },
  economy: { label: "경제", icon: Globe },
  etc: { label: "기타", icon: Globe },
};

export default function CategoryArchive({
  categories = DEFAULT_CATEGORIES,
  onViewAll,
  onCategoryClick,
  onTitleClick,
}) {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end gap-4">
        <button
          type="button"
          onClick={onTitleClick}
          className="space-y-1 text-left transition-opacity hover:opacity-80"
        >
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            카테고리별 아카이브
          </h2>
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
            분야별로 분류된 팩트체크 사례를 확인하세요.
          </p>
        </button>

        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1 text-sm font-bold text-slate-900 transition-colors hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
        >
          전체보기 <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Object.entries(categories).map(([slug, meta]) => {
          const Icon = meta.icon ?? Globe;

          return (
            <button
              key={slug}
              type="button"
              onClick={() => onCategoryClick?.({ slug, ...meta })}
              className="group flex cursor-pointer flex-col items-center rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-all group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/50 dark:text-blue-400 dark:group-hover:bg-blue-500">
                <Icon size={20} />
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
