import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { isLoggedIn } from "../lib/auth";
import {
  Search,
  Clock,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  AlertCircle,
  ArrowUpDown,
  Trash2,
  Heart,
  Pencil,
} from "lucide-react";

/**
 * 리스크 차트 컴포넌트
 */
const RiskChart = ({ score }) => {
  const validScore =
    typeof score === "number" && !Number.isNaN(score)
      ? Math.min(1, Math.max(0, score))
      : 0;

  /** 결과 화면 RiskChart와 동일 구간 (0~1) */
  const getChartColor = (s) => {
    if (s <= 0.33) return "#10b981";
    if (s <= 0.5) return "#f59e0b";
    if (s <= 0.66) return "#f97316";
    return "#ef4444";
  };

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - validScore * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="#f1f5f9"
          strokeWidth="4"
          fill="transparent"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke={getChartColor(validScore)}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-[8px] font-black text-slate-700">
        {Math.round(validScore * 100)}%
      </span>
    </div>
  );
};

const DEFAULTS = {
  category: "all", // path param 기본값
  page: 1,
  q: "",
  sort: "latest", // latest | oldest  (일단 로컬 state)
  size: 6,
};

const CATEGORY_OPTIONS = [
  { key: "all", label: "전체" },
  { key: "enter", label: "연예" },
  { key: "social", label: "사회" },
  { key: "politics", label: "정치" },
  { key: "economy", label: "경제" },
  { key: "etc", label: "기타" },
  { key: "my", label: "MY" },
  { key: "favorites", label: "찜" },
];

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : min;
  return Math.min(max, Math.max(min, x));
}

function safeSort(v) {
  return v === "oldest" ? "oldest" : "latest";
}

function safeCategoryKey(v) {
  const ok = CATEGORY_OPTIONS.some((c) => c.key === v);
  return ok ? v : DEFAULTS.category;
}

export default function ArchiveView() {
  const navigate = useNavigate();
  const params = useParams();

  // --- URL(path)에서 읽기 ---
  const category = useMemo(
    () => safeCategoryKey((params.category || DEFAULTS.category).toLowerCase()),
    [params.category],
  );

  const page = useMemo(
    () => clampInt(parseInt(params.page || `${DEFAULTS.page}`, 10), 1, 9999),
    [params.page],
  );

  // --- sort/q는 당장은 로컬 state (원하면 나중에 querystring으로 섞어도 됨) ---
  const [sort, setSort] = useState(DEFAULTS.sort);
  const [searchInput, setSearchInput] = useState(DEFAULTS.q);
  const [q, setQ] = useState(DEFAULTS.q); // 실제 적용되는 검색어 (submit 시 반영)

  // 데이터 상태
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // path 업데이트 헬퍼
  const goTo = useCallback(
    ({ nextCategory = category, nextPage = page }) => {
      const c = safeCategoryKey(nextCategory);
      const p = clampInt(Number(nextPage), 1, 9999);
      navigate(`/archive/${c}/${p}`);
    },
    [navigate, category, page],
  );

  /** 서버 붙일때:
   * GET /api/archive?category=...&page=...&q=...&sort=...&size=...
   * 응답: { items: [...], total_pages: n } 같은 형태 추천
   */
  const fetchArchiveData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (
      (category === "my" || category === "favorites") &&
      !isLoggedIn()
    ) {
      setItems([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    try {
      const qs = new URLSearchParams({
        category,
        page: String(page),
        q,
        sort,
        size: String(DEFAULTS.size),
      });
      const data = await api.get(`/api/archive?${qs.toString()}`);

      const pages = Math.max(1, Number(data.total_pages) || 1);
      const safePage = clampInt(page, 1, pages);

      if (safePage !== page) {
        goTo({ nextCategory: category, nextPage: safePage });
        return;
      }

      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalPages(pages);
    } catch (e) {
      setError(
        e?.message ||
          "데이터를 불러오는 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [category, page, q, sort, goTo]);

  const cancelDeleteConfirm = useCallback(() => {
    if (deletingId != null) return;
    setDeleteTarget(null);
  }, [deletingId]);

  const confirmDeleteArchive = useCallback(async () => {
    if (!deleteTarget) return;
    const itemId = deleteTarget.id;
    setDeletingId(itemId);
    try {
      await api.del(`/api/archive/${itemId}`);
      setDeleteTarget(null);
      await fetchArchiveData();
    } catch (err) {
      window.alert(err?.message || "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, fetchArchiveData]);

  const handleOpenArchiveItem = useCallback(
    (itemId) => {
      navigate(`/result/archive/${itemId}`, {
        state: {
          fromArchive: true,
          returnPath: `/archive/${category}/${page}`,
        },
      });
    },
    [navigate, category, page],
  );

  const openRenameModal = useCallback((item) => {
    setDeleteTarget(null);
    setRenameDraft(item.title || "");
    setRenameModal({ id: item.id });
  }, []);

  const resetRenameModal = useCallback(() => {
    setRenameModal(null);
    setRenameDraft("");
  }, []);

  const closeRenameModal = useCallback(() => {
    if (renameSaving) return;
    resetRenameModal();
  }, [renameSaving, resetRenameModal]);

  const submitRename = useCallback(async () => {
    if (!renameModal) return;
    const t = renameDraft.trim();
    if (!t) {
      window.alert("제목을 입력해 주세요.");
      return;
    }
    setRenameSaving(true);
    try {
      await api.patch(`/api/archive/${renameModal.id}`, { title: t });
      resetRenameModal();
      await fetchArchiveData();
    } catch (err) {
      window.alert(err?.message || "제목 수정에 실패했습니다.");
    } finally {
      setRenameSaving(false);
    }
  }, [renameModal, renameDraft, fetchArchiveData, resetRenameModal]);

  useEffect(() => {
    fetchArchiveData();
  }, [fetchArchiveData]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  };

  /** 결과 화면 RiskChart getLabel과 동일 (0~1) */
  const riskLabel = (s) => {
    const x =
      typeof s === "number" && !Number.isNaN(s) ? Math.min(1, Math.max(0, s)) : 0;
    if (x > 0.66) return { label: "CRITICAL", cls: "text-red-600" };
    if (x > 0.5) return { label: "HIGH", cls: "text-orange-500" };
    if (x > 0.33) return { label: "MODERATE", cls: "text-amber-500" };
    return { label: "LOW", cls: "text-emerald-500" };
  };

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const pageButtons = useMemo(() => {
    const tp = Number(totalPages) || 1;
    const p = Number(page) || 1;
    if (tp <= 1) return [1];

    const start = Math.max(1, Math.min(tp - 2, p - 1));
    return [start, start + 1, start + 2];
  }, [page, totalPages]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12 animate-in fade-in duration-700">
      {/* 헤더 */}
      <div className="space-y-6 text-center md:text-left">
        <div className="space-y-2">
          <p className="text-blue-600 font-black text-xs uppercase tracking-[0.3em]">
            Official Database
          </p>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            검증 결과 아카이브
          </h1>
          <p className="max-w-2xl text-pretty text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
            FAITH AI 엔진이 검증한 사례를 카테고리·키워드·날짜 기준으로 검색하고 탐색해 보세요.
          </p>
          {category === "my" && isLoggedIn() && (
            <p className="text-xs font-bold text-blue-600">
              내가 「아카이브 저장」한 검증 결과만 보입니다.
            </p>
          )}
          {category === "favorites" && isLoggedIn() && (
            <p className="text-xs font-bold text-rose-600">
              전체 아카이브 중 하트를 눌러 찜한 항목만 모아 보여 줍니다.
            </p>
          )}
        </div>

        {/* 카테고리 */}
        <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-4">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => goTo({ nextCategory: cat.key, nextPage: 1 })}
              className={`cursor-pointer rounded-xl border px-5 py-2 text-xs font-black transition-all duration-200 ${
                category === cat.key
                  ? cat.key === "favorites"
                    ? "border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-200/60 hover:border-rose-600 hover:bg-rose-600 hover:shadow-lg"
                    : "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200/60 hover:border-blue-700 hover:bg-blue-700 hover:shadow-lg"
                  : cat.key === "favorites"
                    ? "border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm active:scale-[0.98]"
                    : "border-slate-200 bg-white text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm active:scale-[0.98]"
              }`}
            >
              {cat.key === "favorites" ? (
                <span className="inline-flex items-center gap-1">
                  <Heart size={12} className="shrink-0" strokeWidth={2.5} />
                  {cat.label}
                </span>
              ) : (
                cat.label
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 검색만 흰 박스 / 정렬은 박스 밖 아래 */}
      <div className="space-y-3">
        <div className="rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
          <form
            className="relative w-full"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(searchInput.trim());
              goTo({ nextCategory: category, nextPage: 1 });
            }}
          >
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="검증 사례 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-2xl border-none bg-slate-50 py-3 pl-11 pr-24 text-xs font-bold outline-none sm:py-3.5 sm:pr-28 sm:text-sm"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-xl bg-blue-600 px-3 py-1.5 text-[10px] font-black text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-95 sm:px-4 sm:py-2 sm:text-xs"
            >
              검색
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:justify-start">
          <ArrowUpDown size={14} className="text-slate-300" />
          <div className="flex rounded-xl border border-slate-100 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => {
                setSort("latest");
                goTo({ nextCategory: category, nextPage: 1 });
              }}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-black transition-all duration-200 sm:text-xs ${
                sort === "latest"
                  ? "bg-white text-blue-600 shadow-sm hover:bg-blue-50"
                  : "text-slate-400 hover:bg-white/80 hover:text-blue-600"
              }`}
            >
              최신순
            </button>
            <button
              type="button"
              onClick={() => {
                setSort("oldest");
                goTo({ nextCategory: category, nextPage: 1 });
              }}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-black transition-all duration-200 sm:text-xs ${
                sort === "oldest"
                  ? "bg-white text-blue-600 shadow-sm hover:bg-blue-50"
                  : "text-slate-400 hover:bg-white/80 hover:text-blue-600"
              }`}
            >
              오래된순
            </button>
          </div>
        </div>
      </div>

      {/* 상태별 렌더 */}
      {loading ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-400 font-bold animate-pulse text-sm">
            최신 아카이브를 불러오는 중...
          </p>
        </div>
      ) : error ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center bg-red-50 rounded-[3rem] border border-red-100 p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-red-600 font-black mb-2">로드 실패</p>
          <button
            type="button"
            onClick={fetchArchiveData}
            className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-xs"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          {/* 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.length > 0 ? (
              items.map((item) => {
                const risk = riskLabel(item.risk_score);
                const isMy = category === "my";
                return (
                  <div
                    key={item.id}
                    className="group relative flex cursor-pointer flex-col rounded-[2rem] border border-slate-100 bg-white p-7 shadow-sm transition-all duration-200 hover:border-blue-400 hover:shadow-md"
                  >
                    {isMy && (
                      <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            renameSaving ||
                            deletingId === item.id ||
                            deleteTarget?.id === item.id
                          }
                          onClick={() => openRenameModal(item)}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="제목 수정"
                          title="제목 수정"
                        >
                          <Pencil size={16} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          disabled={
                            deletingId === item.id || deleteTarget?.id === item.id
                          }
                          onClick={() => {
                            setRenameModal(null);
                            setDeleteTarget({
                              id: item.id,
                              title: item.title || "",
                            });
                          }}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-red-100 bg-white text-red-500 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="아카이브에서 삭제"
                          title="삭제"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenArchiveItem(item.id)}
                      className={`flex flex-1 cursor-pointer flex-col text-left ${isMy ? "pr-[5.5rem]" : ""}`}
                    >
                      <div className="mb-4 flex items-start pr-0">
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                          {item.category_label ?? item.category_key}
                        </span>
                      </div>

                      <h3 className="mb-4 flex-grow text-lg font-bold leading-tight text-slate-800">
                        {item.title}
                      </h3>

                      <div className="mb-6 flex items-center gap-4 text-[10px] font-bold text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {formatDate(item.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShieldAlert size={12} /> {item.author_name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-50 pt-6">
                        <div className="flex items-center gap-3">
                          <RiskChart score={item.risk_score} />
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-300">
                              Risk Index
                            </p>
                            <p className={`text-xs font-black ${risk.cls}`}>
                              {risk.label}
                            </p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50">
                          <ChevronRight size={16} className="text-slate-300" />
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })
            ) : category === "my" && !isLoggedIn() ? (
              <div className="col-span-full rounded-[2rem] border border-blue-100 bg-blue-50/50 py-20 text-center">
                <p className="mb-4 font-black text-slate-800">
                  MY 아카이브는 로그인 후 이용할 수 있습니다.
                </p>
                <p className="mb-6 text-sm text-slate-500">
                  로그인한 뒤 저장한 검증 결과만 이 목록에 모입니다.
                </p>
                <Link
                  to="/login"
                  className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700"
                >
                  로그인하기
                </Link>
              </div>
            ) : category === "favorites" && !isLoggedIn() ? (
              <div className="col-span-full rounded-[2rem] border border-blue-100 bg-blue-50/50 py-20 text-center">
                <p className="mb-4 font-black text-slate-800">
                  찜 목록은 로그인 후 이용할 수 있습니다.
                </p>
                <p className="mb-6 text-sm text-slate-500">
                  아카이브 상세에서 하트를 누른 항목만 모아 볼 수 있습니다.
                </p>
                <Link
                  to="/login"
                  className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700"
                >
                  로그인하기
                </Link>
              </div>
            ) : category === "my" && isLoggedIn() ? (
              <div className="col-span-full py-24 text-center">
                <p className="font-bold text-slate-400">
                  저장한 아카이브가 없습니다.
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  검증 결과 화면에서 「아카이브 저장」을 누르면 여기에 표시됩니다.
                </p>
              </div>
            ) : category === "favorites" && isLoggedIn() ? (
              <div className="col-span-full py-24 text-center">
                <p className="font-bold text-slate-400">
                  찜한 아카이브가 없습니다.
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  항목을 열고 왼쪽 상단 하트를 눌러 찜해 보세요.
                </p>
              </div>
            ) : (
              <div className="col-span-full py-24 text-center">
                <p className="font-bold text-slate-400">
                  검색 결과가 없습니다.
                </p>
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          <div className="flex justify-center items-center gap-1 pt-8">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => goTo({ nextCategory: category, nextPage: 1 })}
              className="p-2 text-slate-300 disabled:opacity-20"
            >
              <ChevronsLeft size={18} />
            </button>

            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() =>
                goTo({ nextCategory: category, nextPage: page - 1 })
              }
              className="p-2 text-slate-300 disabled:opacity-20 mr-4"
            >
              <ChevronLeft size={18} />
            </button>

            {pageButtons.map((p) => {
              const isActive = p === page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => goTo({ nextCategory: category, nextPage: p })}
                  className={
                    isActive
                      ? "w-10 h-10 rounded-xl bg-blue-600 text-white font-black shadow-lg"
                      : "w-10 h-10 rounded-xl text-slate-400 font-black hover:bg-white hover:shadow-sm"
                  }
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={!canGoNext}
              onClick={() =>
                goTo({ nextCategory: category, nextPage: page + 1 })
              }
              className="p-2 text-slate-300 disabled:opacity-20 ml-4"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              disabled={!canGoNext}
              onClick={() =>
                goTo({ nextCategory: category, nextPage: totalPages })
              }
              className="p-2 text-slate-300 disabled:opacity-20"
            >
              <ChevronsRight size={18} />
            </button>
          </div>

          <div className="text-center text-[10px] font-bold text-slate-300 pt-2">
            /archive/{category}/{page} · total={totalPages} · sort={sort}
            {q ? ` · q="${q}"` : ""}
          </div>
        </>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelDeleteConfirm();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="archive-delete-title"
              className="mb-2 text-lg font-black text-slate-900"
            >
              삭제할까요?
            </h2>
            <p className="mb-3 text-sm font-medium text-slate-600">
              MY 아카이브에서 이 항목을 삭제합니다. 되돌릴 수 없습니다.
            </p>
            {deleteTarget.title ? (
              <p className="mb-6 line-clamp-3 text-xs font-bold text-slate-400">
                {deleteTarget.title}
              </p>
            ) : (
              <div className="mb-6" />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingId != null}
                onClick={cancelDeleteConfirm}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deletingId != null}
                onClick={confirmDeleteArchive}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId != null ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {renameModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-rename-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRenameModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="archive-rename-title"
              className="mb-4 text-lg font-black text-slate-900"
            >
              제목 수정
            </h2>
            <p className="mb-3 text-xs font-medium text-slate-500">
              목록에 표시되는 이름입니다. (최대 255자)
            </p>
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
              }}
              className="mb-6 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              maxLength={255}
              autoFocus
              disabled={renameSaving}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={renameSaving}
                onClick={closeRenameModal}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={renameSaving}
                onClick={submitRename}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {renameSaving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
