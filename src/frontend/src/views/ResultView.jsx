import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Bookmark,
  ChevronLeft,
  Heart,
  Loader2,
  Pencil,
  Share2,
} from "lucide-react";
import RiskChart from "../components/RiskChart";
import { api } from "../lib/api";
import { isLoggedIn } from "../lib/auth";

/** Risk Level 한글 */
function koRiskLevel(level) {
  const L = String(level || "").toUpperCase();
  if (L === "LOW") return "낮음";
  if (L === "MEDIUM" || L === "MODERATE") return "주의";
  if (L === "HIGH") return "높음";
  if (L === "CRITICAL") return "매우 높음";
  return level || "-";
}

/** 3) 핵심 판단 */
function getCoreJudgement(level) {
  const L = String(level || "").toUpperCase();
  if (L === "LOW") return "조작 또는 합성 정황은 확인되지 않았습니다.";
  if (L === "MODERATE" || L === "MEDIUM")
    return "합성 또는 조작 가능성이 일부 확인되었습니다.";
  if (L === "HIGH") return "인위적 합성/조작 정황이 뚜렷하게 확인되었습니다.";
  if (L === "CRITICAL")
    return "조작 가능성이 매우 높아 즉각적인 주의가 필요합니다.";
  return "판단 기준을 확인할 수 없습니다.";
}

/** 4) 권장 */
function getRecommendation(level) {
  const L = String(level || "").toUpperCase();
  if (L === "LOW") return "권장: 추가 조치 없이 확인 수준으로 충분합니다.";
  if (L === "MODERATE" || L === "MEDIUM")
    return "권장: 공유/확산 전 출처를 한 번 더 확인하세요.";
  if (L === "HIGH")
    return "권장: 공유를 보류하고, 출처/원본 여부를 확인하세요.";
  if (L === "CRITICAL")
    return "권장: 공유를 중단하고, 신고/차단 등 즉각적인 대응을 고려하세요.";
  return "권장: 공유/확산 전 출처를 확인하세요.";
}

/** 2) 위험도 단정 문구 제거 (필요하면 계속 추가 가능) */
function stripRiskClaims(text) {
  if (!text) return "";
  return String(text)
    .replace(/위험도는\s*(낮습니다|높습니다|매우 높습니다)\.?/g, "")
    .replace(/위험도가\s*(낮습니다|높습니다|매우 높습니다)\.?/g, "")
    .replace(/안전합니다\.?/g, "")
    .replace(/주의가 필요합니다\.?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 5) Detection 표시 (6개 라벨로 정규화) */
function normalizeDetection(value) {
  const v = String(value || "").trim();
  const lower = v.toLowerCase();

  if (!v || v === "-" || lower === "uncertain") return "기타";

  // 이미 한글 라벨로 내려오는 경우
  if (v === "정상") return "정상";
  if (v === "허위정보") return "허위정보";
  if (v === "딥페이크") return "딥페이크";
  if (v === "금융 사기") return "금융 사기";
  if (v === "혐오/폭력") return "혐오/폭력";
  if (v === "성적 콘텐츠") return "성적 콘텐츠";

  // 영어/기타 표현 대응
  if (v.includes("정상") || lower.includes("normal")) return "정상";
  if (
    v.includes("허위") ||
    v.includes("가짜") ||
    lower.includes("misinfo") ||
    lower.includes("fake")
  )
    return "허위정보";
  if (
    v.includes("딥페이크") ||
    lower.includes("deepfake") ||
    lower.includes("synthetic") ||
    lower.includes("manipulated")
  )
    return "딥페이크";
  if (
    v.includes("금융") ||
    v.includes("사기") ||
    lower.includes("scam") ||
    lower.includes("phishing") ||
    lower.includes("fraud")
  )
    return "금융 사기";
  if (
    v.includes("혐오") ||
    v.includes("폭력") ||
    lower.includes("hate") ||
    lower.includes("violence")
  )
    return "혐오/폭력";
  if (
    v.includes("성적") ||
    lower.includes("sexual") ||
    lower.includes("nudity") ||
    lower.includes("adult")
  )
    return "성적 콘텐츠";

  return "기타";
}

/** agents 중 점수가 더 높은 AI 1개 고르기
 *  - 다양한 키를 대응 (score01/score/confidence/risk_score)
 *  - score01은 0~1, risk_score는 보통 0~100
 */
function pickBestAgent(agents = {}) {
  const entries = Object.entries(agents || {});
  if (!entries.length) return null;

  const scored = entries.map(([name, a]) => {
    // skip/error인 경우 점수 낮게
    const isSkipped = !!a?.skipped;
    const hasError = !!a?.error;

    let score01 =
      (typeof a?.score01 === "number" && a.score01) ||
      (typeof a?.score === "number" && a.score) ||
      (typeof a?.confidence === "number" && a.confidence) ||
      (typeof a?.risk_score === "number" && a.risk_score / 100) ||
      -1;

    // score가 0~100으로 들어오는 케이스 방어 (예: score=74)
    if (score01 > 1 && score01 <= 100) score01 = score01 / 100;

    // skipped/error면 약하게
    if (isSkipped) score01 = Math.min(score01, -0.5);
    if (hasError) score01 = Math.min(score01, -0.8);

    return { name, a, score01: typeof score01 === "number" ? score01 : -1 };
  });

  scored.sort((x, y) => y.score01 - x.score01);

  // 만약 전부 -1 이하라면: 우선순위로 선택(가능하면 gemini -> hf -> groq)
  if (scored[0]?.score01 <= -0.5) {
    const byPriority =
      scored.find((s) => s.name === "gemini") ||
      scored.find((s) => s.name === "hf") ||
      scored.find((s) => s.name === "groq") ||
      scored[0];
    return byPriority || null;
  }

  return scored[0] || null;
}

/** reason 후보 중 Top 1개 */
function pickTopReason(agentObj) {
  if (!agentObj) return "";

  const candidates = [
    agentObj.reason,
    agentObj.explanation,
    agentObj.summary,
    agentObj.raw?.reason,
    agentObj.raw?.notes,
    agentObj.detail?.reason,
    agentObj.detail?.notes,
    agentObj.risk_reason,
  ].filter(Boolean);

  const top = candidates[0] ? String(candidates[0]).trim() : "";
  if (!top) return "";

  // 내부 메시지 치환
  if (top.toLowerCase() === "no text") {
    return "텍스트 입력이 없어 텍스트 기반 근거가 제한됩니다. 이미지/출처 정보를 함께 확인하세요.";
  }

  return stripRiskClaims(top);
}

/** degraded/에러 플래그 */
function detectDegraded(result) {
  const rv = String(result?._router_version || "");
  const byVersion = rv.toLowerCase().includes("degraded");
  const byAgents = Object.values(result?.agents || {}).some((a) => !!a?.error);
  return byVersion || byAgents;
}

export default function ResultView() {
  const params = useParams();
  const archiveIdFromRoute = params.archiveId;
  const { state } = useLocation();
  const navigate = useNavigate();

  const [archiveBundle, setArchiveBundle] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(
    Boolean(archiveIdFromRoute),
  );
  const [archiveError, setArchiveError] = useState(null);

  useEffect(() => {
    if (!archiveIdFromRoute) {
      setArchiveLoading(false);
      setArchiveBundle(null);
      setArchiveError(null);
      return;
    }
    let cancelled = false;
    setArchiveLoading(true);
    setArchiveError(null);
    api
      .get(`/api/archive/items/${archiveIdFromRoute}`)
      .then((data) => {
        if (cancelled) return;
        if (!data?.result || typeof data.result !== "object") {
          setArchiveError("저장된 검증 데이터를 불러올 수 없습니다.");
          setArchiveBundle(null);
          return;
        }
        setArchiveBundle({
          result: data.result,
          favorited: Boolean(data.favorited),
          itemId: Number(archiveIdFromRoute),
          listTitle: typeof data.title === "string" ? data.title : "",
          isOwner: Boolean(data.is_owner),
          authorName:
            typeof data.author_name === "string" ? data.author_name : "",
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setArchiveError(e?.message || "검증 결과를 불러오지 못했습니다.");
          setArchiveBundle(null);
        }
      })
      .finally(() => {
        if (!cancelled) setArchiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [archiveIdFromRoute]);

  const result = archiveBundle?.result ?? state?.result;
  const fromArchive =
    Boolean(archiveIdFromRoute) || Boolean(state?.fromArchive);
  const archiveItemId = archiveBundle?.itemId ?? state?.archiveItemId;
  const returnPath = state?.returnPath || "/archive/all/1";
  const sourceText = state?.sourceText;
  const sourceImageDataUrl = state?.sourceImageDataUrl;
  const sourceFileHint = state?.sourceFileHint;

  const [archiveSaving, setArchiveSaving] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState(null);
  const [archiveSaved, setArchiveSaved] = useState(false);
  const [savedArchiveId, setSavedArchiveId] = useState(null);
  const [hearted, setHearted] = useState(false);
  const [heartLoading, setHeartLoading] = useState(false);

  const [titleRenameOpen, setTitleRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);

  useEffect(() => {
    if (archiveBundle) {
      setHearted(archiveBundle.favorited);
    } else if (state?.archiveFavorited != null) {
      setHearted(Boolean(state.archiveFavorited));
    }
  }, [archiveBundle, state?.archiveFavorited]);

  const { reportText, detectionLabel, confidenceText, degradedNotice } =
    useMemo(() => {
      if (!result || typeof result !== "object") {
        return {
          reportText: "",
          detectionLabel: "기타",
          confidenceText: "0%",
          degradedNotice: null,
        };
      }
      const score100Inner = Number(result.final?.risk_score ?? 0);
      const levelInner = result.final?.risk_level;
      const categoryInner = result.final?.risk_category;
      const coreInner = getCoreJudgement(levelInner);
      const recInner = getRecommendation(levelInner);
      const best = pickBestAgent(result.agents || {});

      const reasonsByCategory = result.final?.reasons_by_category || [];
      const topCategoryGroup =
        reasonsByCategory.find((r) => r.category === categoryInner) ||
        reasonsByCategory[0];
      const topReasonFromCategory = topCategoryGroup?.agents?.[0]?.reason || "";

      const topReason = topReasonFromCategory || pickTopReason(best?.a);

      const rawDetection =
        best?.a?.detection ||
        best?.a?.category ||
        result.final?.risk_category ||
        "기타";
      const detection = normalizeDetection(rawDetection);

      const bestScore01 =
        typeof best?.score01 === "number" && best.score01 >= 0
          ? best.score01
          : null;

      const confText =
        bestScore01 !== null
          ? `${Math.round(bestScore01 * 100)}%`
          : `${Math.round(score100Inner)}%`;

      const degraded = detectDegraded(result);

      const text = [
        `카테고리: ${categoryInner || "-"}`,
        ``,
        `핵심 판단: ${coreInner}`,
        ``,
        `근거: ${topReason || "근거 정보를 확인할 수 없습니다."}`,
        ``,
        `${recInner}`,
      ].join("\n");

      const notice = degraded
        ? "⚠️ 일부 검증 엔진이 제한되어 결과가 불완전할 수 있습니다."
        : null;

      return {
        reportText: text,
        detectionLabel: detection,
        confidenceText: confText,
        degradedNotice: notice,
      };
    }, [result]);

  if (archiveLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-10">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm font-bold text-slate-500">
          검증 결과를 불러오는 중…
        </p>
      </div>
    );
  }

  if (archiveError) {
    return (
      <div className="max-w-5xl mx-auto p-10 text-center">
        <h1 className="mb-2 text-xl font-black text-red-600">불러오기 실패</h1>
        <p className="mb-6 text-slate-600">{archiveError}</p>
        <button
          type="button"
          onClick={() => navigate(returnPath)}
          className="rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white"
        >
          아카이브로 돌아가기
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-5xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-black mb-3">검증 결과가 없습니다</h1>
        <p className="text-slate-500 mb-6">
          홈에서 검증을 실행하면 결과가 표시됩니다.
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold"
        >
          홈으로
        </button>
      </div>
    );
  }

  const score100 = Number(result.final?.risk_score ?? 0); // 0~100
  const score01 = Math.max(0, Math.min(1, score100 / 100));

  const level = result.final?.risk_level;

  const archiveMeta = result._faith_archive_meta;
  const previewText =
    (typeof archiveMeta?.text === "string" && archiveMeta.text) ||
    (typeof sourceText === "string" && sourceText) ||
    null;
  const rawMetaImageUrl =
    typeof archiveMeta?.image_url === "string"
      ? archiveMeta.image_url.trim()
      : "";
  const previewImageFromFile =
    rawMetaImageUrl.startsWith("/api/archive/preview-image/")
      ? rawMetaImageUrl
      : null;
  const previewImage =
    previewImageFromFile ||
    (typeof archiveMeta?.image_data_url === "string" &&
      archiveMeta.image_data_url) ||
    (typeof sourceImageDataUrl === "string" && sourceImageDataUrl) ||
    null;
  const previewFileHint =
    (typeof archiveMeta?.file_hint === "string" && archiveMeta.file_hint) ||
    (typeof sourceFileHint === "string" && sourceFileHint) ||
    null;
  const imageOmittedReason =
    typeof archiveMeta?.image_omitted_reason === "string"
      ? archiveMeta.image_omitted_reason
      : null;
  const showArchiveSubjectPanel = fromArchive;
  const hasArchiveSubjectContent =
    Boolean(previewText?.trim()) ||
    Boolean(previewImage) ||
    Boolean(previewFileHint);

  const handleSaveArchive = async () => {
    if (!isLoggedIn()) {
      setArchiveMsg({
        type: "err",
        text: "아카이브 저장은 회원만 가능한 기능입니다.",
      });
      return;
    }
    setArchiveMsg(null);
    setArchiveSaving(true);
    try {
      const resultToSave = { ...result };
      const meta = { ...(resultToSave._faith_archive_meta || {}) };
      if (sourceText) meta.text = sourceText;
      if (sourceFileHint) meta.file_hint = sourceFileHint;

      delete meta.image_url;
      delete meta.image_data_url;
      delete meta.image_omitted_reason;

      let uploadedPreviewUrl = null;
      if (
        sourceImageDataUrl &&
        typeof sourceImageDataUrl === "string" &&
        sourceImageDataUrl.startsWith("data:")
      ) {
        try {
          const blob = await (await fetch(sourceImageDataUrl)).blob();
          const fd = new FormData();
          fd.append("file", blob, "verify-preview.png");
          const up = await api.upload("/api/archive/preview-image", fd);
          if (typeof up?.image_url === "string") uploadedPreviewUrl = up.image_url;
        } catch {
          uploadedPreviewUrl = null;
        }
      }
      if (uploadedPreviewUrl) {
        meta.image_url = uploadedPreviewUrl;
      } else if (sourceImageDataUrl) {
        meta.image_data_url = sourceImageDataUrl;
      }

      if (meta.text || meta.image_data_url || meta.file_hint || meta.image_url) {
        resultToSave._faith_archive_meta = meta;
      } else {
        delete resultToSave._faith_archive_meta;
      }
      const data = await api.post("/api/archive/save", { result: resultToSave });
      setSavedArchiveId(data?.id ?? null);
      setArchiveSaved(true);
    } catch (err) {
      setArchiveMsg({
        type: "err",
        text: err?.message || "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setArchiveSaving(false);
    }
  };

  const handleCancelArchive = async () => {
    if (!isLoggedIn()) {
      setArchiveMsg({
        type: "err",
        text: "아카이브 취소는 로그인 후 이용할 수 있습니다.",
      });
      return;
    }
    if (savedArchiveId == null) {
      setArchiveSaved(false);
      setArchiveMsg(null);
      return;
    }
    setArchiveMsg(null);
    setArchiveSaving(true);
    try {
      await api.del(`/api/archive/${savedArchiveId}`);
      setSavedArchiveId(null);
      setArchiveSaved(false);
    } catch (err) {
      setArchiveMsg({
        type: "err",
        text: err?.message || "저장 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setArchiveSaving(false);
    }
  };

  const handleToggleHeart = async () => {
    if (archiveItemId == null) return;
    if (!isLoggedIn()) {
      window.alert("찜하려면 로그인해 주세요.");
      return;
    }
    setHeartLoading(true);
    try {
      if (hearted) {
        await api.del(`/api/archive/items/${archiveItemId}/favorite`);
        setHearted(false);
      } else {
        await api.post(`/api/archive/items/${archiveItemId}/favorite`, {});
        setHearted(true);
      }
    } catch (err) {
      window.alert(err?.message || "찜 처리에 실패했습니다.");
    } finally {
      setHeartLoading(false);
    }
  };

  const archiveListTitleTrim =
    typeof archiveBundle?.listTitle === "string"
      ? archiveBundle.listTitle.trim()
      : "";
  const archiveHeadlineFromApi =
    Boolean(archiveIdFromRoute) && fromArchive && archiveBundle != null;
  const reportMainHeadline =
    archiveHeadlineFromApi && archiveListTitleTrim
      ? archiveListTitleTrim
      : "검증 상세 리포트";
  const archiveAuthorDisplay = (() => {
    if (!archiveHeadlineFromApi || !archiveBundle) return null;
    const raw =
      typeof archiveBundle.authorName === "string"
        ? archiveBundle.authorName.trim()
        : "";
    if (!raw || raw === "익명") return "비회원";
    return raw;
  })();
  const canEditArchiveHeadline =
    archiveHeadlineFromApi &&
    archiveBundle?.isOwner &&
    archiveItemId != null &&
    isLoggedIn();

  const openArchiveTitleEdit = () => {
    if (!archiveBundle) return;
    setTitleDraft(archiveBundle.listTitle || "");
    setTitleRenameOpen(true);
  };

  const closeArchiveTitleEdit = () => {
    if (titleSaving) return;
    setTitleRenameOpen(false);
    setTitleDraft("");
  };

  const submitArchiveTitleEdit = async () => {
    if (archiveItemId == null) return;
    const t = titleDraft.trim();
    if (!t) {
      window.alert("제목을 입력해 주세요.");
      return;
    }
    setTitleSaving(true);
    try {
      await api.patch(`/api/archive/${archiveItemId}`, { title: t });
      setArchiveBundle((prev) =>
        prev ? { ...prev, listTitle: t } : prev,
      );
      setTitleRenameOpen(false);
      setTitleDraft("");
    } catch (err) {
      window.alert(err?.message || "제목 수정에 실패했습니다.");
    } finally {
      setTitleSaving(false);
    }
  };

  const handleShareArchiveResult = async () => {
    if (archiveItemId == null) return;
    const url = `${window.location.origin}/result/archive/${archiveItemId}`;
    const title =
      archiveListTitleTrim || reportMainHeadline || "FAITH 검증 결과";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text: title, url });
        return;
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        window.alert("링크가 클립보드에 복사되었습니다.");
      } else {
        window.prompt("아래 링크를 복사하세요.", url);
      }
    } catch {
      window.prompt("아래 링크를 복사하세요.", url);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 md:p-10">
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/50 border border-slate-100 p-8 md:p-10">
        {fromArchive && (
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(returnPath)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              aria-label="이전"
              title="이전"
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </button>
            {archiveItemId != null && (
              <>
                <button
                  type="button"
                  disabled={heartLoading}
                  onClick={handleToggleHeart}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                  aria-label={hearted ? "찜 해제" : "찜하기"}
                  title={hearted ? "찜 해제" : "찜하기"}
                >
                  <Heart
                    size={20}
                    strokeWidth={2}
                    className={
                      hearted
                        ? "fill-red-500 text-red-500"
                        : "fill-transparent text-slate-400"
                    }
                  />
                </button>
                <button
                  type="button"
                  onClick={handleShareArchiveResult}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  aria-label="이 결과 공유"
                  title="공유"
                >
                  <Share2 size={20} strokeWidth={2} />
                </button>
              </>
            )}
          </div>
        )}
        {fromArchive && (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-sm font-bold text-blue-800">
            아카이브에 저장된 검증 결과입니다. 당시 저장된 내용을 그대로 보여 줍니다.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* 왼쪽: 차트 */}
          <div className="flex flex-col items-center gap-6">
            <div className="w-full text-center text-slate-500 font-bold text-sm">
              리스크 지수
            </div>

            <RiskChart score={score01} />

            {showArchiveSubjectPanel ? (
              <div className="w-full max-w-md space-y-3 rounded-2xl border border-slate-100 bg-slate-50/90 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                  검증 대상
                </div>
                {previewText?.trim() ? (
                  <p className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                    {previewText}
                  </p>
                ) : null}
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="검증에 사용된 이미지"
                    className="max-h-56 w-full rounded-xl object-contain"
                  />
                ) : null}
                {previewFileHint && !previewImage ? (
                  <p className="text-xs text-slate-500">
                    첨부: {previewFileHint}
                  </p>
                ) : null}
                {!hasArchiveSubjectContent ? (
                  <p className="text-xs font-medium leading-relaxed text-slate-400">
                    {imageOmittedReason === "too_large"
                      ? "이미지 용량이 커서 저장 스냅샷에 포함되지 않았습니다. (당시 검증에는 사용됨)"
                      : "저장된 검증 대상(텍스트·이미지)이 없습니다. 이전에 저장하신 항목이거나 메타가 비어 있을 수 있습니다."}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!fromArchive && (
              <div className="w-full max-w-xs flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="flex-1 rounded-2xl bg-blue-600 py-4 text-lg font-black text-white hover:bg-blue-700"
                  >
                    다시 검증
                  </button>
                  <button
                    type="button"
                    onClick={archiveSaved ? handleCancelArchive : handleSaveArchive}
                    disabled={archiveSaving}
                    className={`group flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 py-4 text-lg font-black transition-colors duration-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 disabled:pointer-events-none disabled:opacity-60 ${
                      archiveSaved
                        ? "border-blue-200 bg-blue-50/90 text-blue-900"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    <Bookmark
                      className={`h-5 w-5 shrink-0 transition-colors duration-200 ${
                        archiveSaved
                          ? "fill-blue-600 text-blue-600"
                          : "fill-transparent text-slate-500 group-hover:text-blue-600"
                      }`}
                      strokeWidth={2}
                    />
                    {archiveSaving
                      ? "저장 중…"
                      : archiveSaved
                        ? "저장됨"
                        : "아카이브 저장"}
                  </button>
                </div>
                {archiveMsg && (
                  <p
                    className={`text-center text-sm font-bold ${
                      archiveMsg.type === "ok"
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {archiveMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 오른쪽: 리포트 */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full text-xs font-black">
              리스크 수준: {Math.round(score100)}%
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-3xl font-black text-slate-900 md:text-4xl">
                  {reportMainHeadline}
                </h1>
                {archiveAuthorDisplay != null ? (
                  <p className="mt-2 text-sm font-bold">
                    <span className="text-slate-400">작성자</span>{" "}
                    <span className="text-slate-500">
                      {archiveAuthorDisplay}
                    </span>
                  </p>
                ) : null}
              </div>
              {canEditArchiveHeadline ? (
                <button
                  type="button"
                  disabled={titleSaving}
                  onClick={openArchiveTitleEdit}
                  className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  aria-label="제목 수정"
                  title="제목 수정"
                >
                  <Pencil size={20} strokeWidth={2} />
                </button>
              ) : null}
            </div>

            {degradedNotice && (
              <div className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                {degradedNotice}
              </div>
            )}

            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/30 space-y-3">
              <div className="font-black text-slate-900">판독 근거</div>

              {/* 스펙 포맷 그대로 출력 */}
              <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                {reportText}
              </pre>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-2xl p-5">
                <div className="text-xs font-black text-slate-400 uppercase">
                  CONFIDENCE
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {confidenceText}
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5">
                <div className="text-xs font-black text-slate-400 uppercase">
                  DETECTION
                </div>
                <div className="mt-2 text-lg font-black text-slate-900">
                  {detectionLabel}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  Risk Level: {koRiskLevel(level)}
                </div>
              </div>
            </div>

            {/* 개발 중 디버그용: 필요하면 주석 해제
                <details className="mt-4">
                <summary className="cursor-pointer text-sm text-slate-500 font-bold">
                    RAW RESULT (debug)
                </summary>
                <pre className="mt-2 text-xs bg-slate-50 p-4 rounded-xl overflow-auto">
                    {JSON.stringify(result, null, 2)}
                </pre>
                </details>
                */}
          </div>
        </div>
      </div>

      {titleRenameOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-archive-rename-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeArchiveTitleEdit();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="result-archive-rename-title"
              className="mb-4 text-lg font-black text-slate-900"
            >
              제목 수정
            </h2>
            <p className="mb-3 text-xs font-medium text-slate-500">
              아카이브 목록과 이 화면 상단에 표시됩니다. (최대 255자)
            </p>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitArchiveTitleEdit();
              }}
              className="mb-6 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              maxLength={255}
              autoFocus
              disabled={titleSaving}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={titleSaving}
                onClick={closeArchiveTitleEdit}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={titleSaving}
                onClick={submitArchiveTitleEdit}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {titleSaving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
