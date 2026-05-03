import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Bookmark,
  ChevronLeft,
  CircleHelp,
  ExternalLink,
  FileDown,
  Heart,
  Loader2,
  Pencil,
  Phone,
  Share2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import RiskChart from "../components/RiskChart";
import AgentCategoryDonut from "../components/AgentCategoryDonut";
import AgentScoreBarChart from "../components/AgentScoreBarChart";
import ShareArchiveModal from "../components/ShareArchiveModal";
import { buildFaithVerdictHeadline } from "../lib/faithVerdictTitle";
import { api } from "../lib/api";
import { maskAuthorDisplay } from "../lib/maskAuthor";
import { isLoggedIn } from "../lib/auth";

/** 경찰 신고 안내를 띄울 위험 구간 (검증 결과 화면) */
function isPoliceReportRiskLevel(level) {
  const L = String(level || "").toUpperCase();
  return L === "HIGH" || L === "CRITICAL";
}

const POLICE_ECRM_URL = "https://ecrm.police.go.kr/minwon/main";

/** AI 분석 시각화: 좌(모델별 위험도) vs 우(카테고리 가중 비율) - 물음표 툴팁 */
const AI_VIZ_LAYOUT_HELP =
  "왼쪽은 모델마다 \"얼마나 위험하다고 보는지\"이고, 오른쪽은 모델들이 붙인 카테고리가 위험도 가중 합산에서 차지하는 비율입니다. 같은 색으로 보여도 서로 다른 축이며, 분석 제외 모델은 왼쪽에만 반영됩니다.";

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
  const byFlag = Boolean(result?.degraded || result?.detail?.degraded);
  const byAgents = Object.values(result?.agents || {}).some((a) => !!a?.error);
  return byVersion || byFlag || byAgents;
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
  const [archiveDeleteOpen, setArchiveDeleteOpen] = useState(false);
  const [archiveDeleting, setArchiveDeleting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  useEffect(() => {
    if (archiveBundle) {
      setHearted(archiveBundle.favorited);
    } else if (state?.archiveFavorited != null) {
      setHearted(Boolean(state.archiveFavorited));
    }
  }, [archiveBundle, state?.archiveFavorited]);

  const {
    reportText,
    detectionLabel,
    confidenceText,
    confidenceTooltip,
    degradedNotice,
  } = useMemo(() => {
      if (!result || typeof result !== "object") {
        return {
          reportText: "",
          detectionLabel: "기타",
          confidenceText: "0%",
          confidenceTooltip: null,
          degradedNotice: null,
        };
      }
      const levelInner = result.final?.risk_level;
      const categoryInner = result.final?.risk_category;
      const degraded = detectDegraded(result);
      const degradedMessage =
        result?.detail?.message ||
        "현재 AI 모델 응답이 지연되어 결과가 불완전할 수 있습니다.";
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

      const integratedPct = Math.round(
        Number(result.final?.risk_score ?? 0),
      );

      /** 최종 통합 risk_score와 다른 개념: pickBestAgent로 고른 단일 모델 위험도(0~1) → CONFIDENCE 칸에 %로 표시 */
      const confText = (() => {
        if (degraded) return "—";
        if (bestScore01 === null) return "—";
        const agentPct = Math.round(bestScore01 * 100);
        return `${agentPct}%`;
      })();

      /** 통합 지수와 %가 같아 보일 때 구분(툴팁·PDF 소문구) */
      const confTip = (() => {
        if (degraded || bestScore01 === null) return null;
        const agentPct = Math.round(bestScore01 * 100);
        const nearSame = Math.abs(agentPct - integratedPct) < 2;
        if (nearSame) {
          return "이 값은 DETECTION 근거에 쓰인 대표 모델 하나의 위험도입니다. 상단 리스크 지수는 여러 모델을 통합한 값이라, 이번 검증에서는 %가 같게 나와도 의미는 다릅니다.";
        }
        return "이 값은 DETECTION 근거에 쓰인 대표 모델 하나의 위험도입니다. 상단 리스크 지수(통합)와 계산 방식이 달라 %가 다를 수 있습니다.";
      })();

      const hasUsableReason = Boolean(topReason);
      const text = degraded && !hasUsableReason
        ? [
            `카테고리: 검증 지연`,
            ``,
            `핵심 판단: 현재 AI 모델 응답 지연으로 자동 판정을 완료하지 못했습니다.`,
            ``,
            `근거: ${degradedMessage}`,
            ``,
            `권장: 잠시 후 다시 시도하거나 텍스트를 함께 입력해 재검증해 주세요.`,
          ].join("\n")
        : [
            `카테고리: ${categoryInner || "-"}`,
            ``,
            `핵심 판단: ${coreInner}`,
            ``,
            `근거: ${topReason || "근거 정보를 확인할 수 없습니다."}`,
            ``,
            `${recInner}`,
          ].join("\n");

      const notice = degraded
        ? `⚠️ ${degradedMessage}`
        : null;

      return {
        reportText: text,
        detectionLabel: detection,
        confidenceText: confText,
        confidenceTooltip: confTip,
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
  const showPoliceReportCta = isPoliceReportRiskLevel(level);

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
  const verdictHeadline = buildFaithVerdictHeadline(detectionLabel, score100);
  const reportMainHeadline =
    archiveHeadlineFromApi && archiveListTitleTrim
      ? archiveListTitleTrim
      : verdictHeadline;
  const archiveAuthorDisplay = (() => {
    if (!archiveHeadlineFromApi || !archiveBundle) return null;
    const raw =
      typeof archiveBundle.authorName === "string"
        ? archiveBundle.authorName.trim()
        : "";
    if (!raw || raw === "익명") return "비회원";
    return maskAuthorDisplay(raw);
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

  const openArchiveDeleteConfirm = () => {
    if (archiveDeleting) return;
    setArchiveDeleteOpen(true);
  };

  const closeArchiveDeleteConfirm = () => {
    if (archiveDeleting) return;
    setArchiveDeleteOpen(false);
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

  const confirmArchiveDelete = async () => {
    if (archiveItemId == null) return;
    setArchiveDeleting(true);
    try {
      await api.del(`/api/archive/${archiveItemId}`);
      setArchiveDeleteOpen(false);
      navigate(returnPath, { replace: true });
    } catch (err) {
      window.alert(err?.message || "아카이브 삭제에 실패했습니다.");
    } finally {
      setArchiveDeleting(false);
    }
  };

  const handleShareArchiveResult = () => {
    if (archiveItemId == null) return;
    setShareModalOpen(true);
  };

  const handleExportPdf = async () => {
    setPdfExporting(true);
    try {
      const { exportResultToPdfDirect } = await import("../lib/exportResultPdf");
      const stamp = new Date().toISOString().slice(0, 10);
      const rawTitle =
        (archiveListTitleTrim && archiveListTitleTrim.trim()) ||
        (typeof reportMainHeadline === "string" && reportMainHeadline.trim()) ||
        "";
      const winIllegal = new Set('<>:"/\\|?*');
      let fileBase = [...rawTitle]
        .filter((ch) => ch.charCodeAt(0) >= 32 && !winIllegal.has(ch))
        .join("")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/g, "");
      if (fileBase.length > 120) fileBase = fileBase.slice(0, 120).trim();
      if (!fileBase) {
        fileBase =
          archiveItemId != null
            ? `FAITH-verification-${archiveItemId}-${stamp}`
            : `FAITH-verification-${stamp}`;
      } else if (fileBase === "검증 상세 리포트") {
        fileBase = `검증-상세-리포트-${stamp}`;
      }
      await exportResultToPdfDirect(
        {
          headline: reportMainHeadline,
          author: archiveAuthorDisplay ?? null,
          score: score100,
          level: String(level ?? ""),
          reportText,
          confidenceText,
          confidenceTooltip,
          detectionLabel,
          previewImage,
          previewText: previewText?.trim() || null,
          agents: result?.agents ?? null,
          finalCategory: result?.final?.risk_category ?? null,
          isArchive: fromArchive,
          archiveItemId: archiveItemId ?? null,
        },
        `${fileBase}.pdf`,
      );
    } catch (err) {
      console.error(err);
      const detail =
        typeof err?.message === "string" && err.message.trim()
          ? `\n\n(${err.message})`
          : "";
      window.alert(
        `PDF로 저장하지 못했습니다.${detail}\n\n인터넷 연결(한글 폰트 다운로드)·이미지 URL 접근을 확인하거나, Chrome/Edge에서 다시 시도해 보세요.`,
      );
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-8 md:p-10">
      <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-2xl shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50 md:p-10">
        {fromArchive && (
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(returnPath)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              aria-label="이전"
              title="이전"
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              disabled={pdfExporting}
              onClick={handleExportPdf}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              aria-label="PDF로 저장"
              title="PDF 저장"
            >
              {pdfExporting ? (
                <Loader2 size={20} strokeWidth={2} className="animate-spin" />
              ) : (
                <FileDown size={20} strokeWidth={2} />
              )}
            </button>
            {archiveItemId != null && (
              <>
                <button
                  type="button"
                  disabled={heartLoading}
                  onClick={handleToggleHeart}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 disabled:opacity-50 dark:border-slate-600 dark:hover:border-red-900 dark:hover:bg-red-950/30"
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
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:bg-slate-800 dark:hover:text-blue-400"
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
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-sm font-bold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
            아카이브에 저장된 검증 결과입니다. 당시 저장된 내용을 그대로 보여 줍니다.
          </div>
        )}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8 lg:gap-10">
          {/* 왼쪽: 차트 — 열 폭을 줄여 우측 제목이 한 줄에 들어가도록 */}
          <div className="flex min-w-0 flex-col items-center gap-6 md:col-span-4 lg:col-span-4">
            <div className="w-full text-center text-sm font-bold text-slate-500 dark:text-slate-400">
              리스크 지수
            </div>

            <RiskChart score={score01} />

            {showArchiveSubjectPanel ? (
              <div className="w-full max-w-md space-y-3 rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  검증 대상
                </div>
                {previewText?.trim() ? (
                  <p className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    첨부: {previewFileHint}
                  </p>
                ) : null}
                {!hasArchiveSubjectContent ? (
                  <p className="text-xs font-medium leading-relaxed text-slate-400 dark:text-slate-500">
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
                    className="flex-1 rounded-2xl bg-blue-600 py-4 text-lg font-black text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    다시 검증
                  </button>
                  <button
                    type="button"
                    onClick={archiveSaved ? handleCancelArchive : handleSaveArchive}
                    disabled={archiveSaving}
                    className={`group flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 py-4 text-base font-black transition-colors duration-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 disabled:pointer-events-none disabled:opacity-60 dark:hover:border-blue-500 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                      archiveSaved
                        ? "border-blue-200 bg-blue-50/90 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100"
                        : "border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                <button
                  type="button"
                  disabled={pdfExporting}
                  onClick={handleExportPdf}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-3.5 text-base font-black text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50/80 hover:text-blue-900 disabled:pointer-events-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-300"
                >
                  {pdfExporting ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <FileDown className="h-5 w-5 shrink-0" strokeWidth={2.2} />
                  )}
                  PDF로 저장
                </button>
              </div>
            )}
          </div>

          {/* 오른쪽: 리포트 */}
          <div className="min-w-0 space-y-6 md:col-span-8 lg:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-600 dark:bg-red-950/50 dark:text-red-400">
              리스크 수준: {Math.round(score100)}%
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-3xl font-black text-slate-900 dark:text-slate-50 md:text-4xl">
                  {reportMainHeadline}
                </h1>
                {archiveAuthorDisplay != null ? (
                  <p className="mt-2 text-sm font-bold">
                    <span className="text-slate-400 dark:text-slate-500">작성자</span>{" "}
                    <span className="text-slate-500 dark:text-slate-400">
                      {archiveAuthorDisplay}
                    </span>
                  </p>
                ) : null}
              </div>
              {canEditArchiveHeadline ? (
                <div className="flex shrink-0 items-center gap-2 self-start">
                  <button
                    type="button"
                    disabled={titleSaving || archiveDeleting}
                    onClick={openArchiveTitleEdit}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                    aria-label="제목 수정"
                    title="제목 수정"
                  >
                    <Pencil size={20} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    disabled={titleSaving || archiveDeleting}
                    onClick={openArchiveDeleteConfirm}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label="아카이브 삭제"
                    title="삭제"
                  >
                    <Trash2 size={20} strokeWidth={2} />
                  </button>
                </div>
              ) : null}
            </div>

            {degradedNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200/90">
                {degradedNotice}
              </div>
            )}

            {showPoliceReportCta && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-600 dark:bg-slate-800/50">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-slate-700 dark:text-red-400">
                    <ShieldAlert className="h-6 w-6" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-black text-red-900 dark:text-red-100">
                      위험도가 높습니다. 피해·범죄가 의심되면 경찰에 신고하세요.
                    </p>
                    <p className="text-xs font-medium leading-relaxed text-red-800/90 dark:text-red-200/75">
                      아래 버튼은 경찰청 전자민원 포털로 연결됩니다. 본 검증 결과는 참고용이며,
                      실제 신고는 경찰 절차에 따라 직접 제출해야 합니다.
                    </p>
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
                      <a
                        href={POLICE_ECRM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        경찰청 온라인 민원·신고
                      </a>
                      <a
                        href="tel:112"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-slate-800"
                      >
                        <Phone className="h-4 w-4 shrink-0" />
                        긴급 112
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/30 p-6 dark:border-slate-600 dark:bg-slate-800/40">
              <div className="font-black text-slate-900 dark:text-slate-100">판독 근거</div>

              {/* 스펙 포맷 그대로 출력 */}
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {reportText}
              </pre>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-600 dark:bg-slate-800/50">
                <div className="flex items-center gap-1.5">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    CONFIDENCE
                  </div>
                  {confidenceTooltip ? (
                    <div className="group relative inline-flex shrink-0 items-center">
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-1"
                        aria-label="CONFIDENCE 설명 보기"
                        aria-describedby="faith-confidence-tip"
                      >
                        <CircleHelp
                          className="h-3.5 w-3.5"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </button>
                      <div
                        id="faith-confidence-tip"
                        role="tooltip"
                        className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2.5rem))] -translate-x-1/2 opacity-0 shadow-lg transition duration-150 ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:w-72"
                      >
                        <div className="relative rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[11px] font-medium leading-snug text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                          <div
                            className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
                            aria-hidden
                          />
                          <p className="relative whitespace-normal">
                            {confidenceTooltip}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">
                  {confidenceText}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-600 dark:bg-slate-800/50">
                <div className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">
                  DETECTION
                </div>
                <div className="mt-2 text-lg font-black text-slate-900 dark:text-slate-50">
                  {detectionLabel}
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

        <section
          className="mt-10 rounded-2xl border border-slate-200 bg-slate-50/30 px-5 py-8 dark:border-slate-600 dark:bg-slate-800/40 md:px-8"
          aria-labelledby="faith-ai-viz-heading"
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <h2
              id="faith-ai-viz-heading"
              className="text-center text-lg font-black tracking-tight text-slate-900 dark:text-slate-50 md:text-xl"
            >
              AI 분석 시각화
            </h2>
            <div className="group relative inline-flex shrink-0 items-center">
              <button
                type="button"
                className="rounded-full p-0.5 text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-1 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="AI 분석 시각화 레이아웃 설명 보기"
                aria-describedby="faith-ai-viz-layout-help"
              >
                <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
              <div
                id="faith-ai-viz-layout-help"
                role="tooltip"
                className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] -translate-x-1/2 opacity-0 shadow-lg transition duration-150 ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:w-96"
              >
                <div className="relative rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[11px] font-medium leading-snug text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  <div
                    className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
                    aria-hidden
                  />
                  <p className="relative whitespace-normal">{AI_VIZ_LAYOUT_HELP}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-2">
            <AgentScoreBarChart result={result} />
            <AgentCategoryDonut result={result} />
          </div>
        </section>
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
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="result-archive-rename-title"
              className="mb-4 text-lg font-black text-slate-900 dark:text-slate-50"
            >
              제목 수정
            </h2>
            <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
              아카이브 목록과 이 화면 상단에 표시됩니다. (최대 255자)
            </p>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitArchiveTitleEdit();
              }}
              className="mb-6 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
              maxLength={255}
              autoFocus
              disabled={titleSaving}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={titleSaving}
                onClick={closeArchiveTitleEdit}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
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
      {archiveDeleteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-archive-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeArchiveDeleteConfirm();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="result-archive-delete-title"
              className="mb-2 text-lg font-black text-slate-900 dark:text-slate-50"
            >
              삭제할까요?
            </h2>
            <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
              이 아카이브를 삭제합니다. 되돌릴 수 없습니다.
            </p>
            <p className="mb-6 line-clamp-3 text-xs font-bold text-slate-400 dark:text-slate-500">
              {archiveListTitleTrim || reportMainHeadline}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={archiveDeleting}
                onClick={closeArchiveDeleteConfirm}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="button"
                disabled={archiveDeleting}
                onClick={confirmArchiveDelete}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {archiveDeleting ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareArchiveModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        url={
          archiveItemId != null
            ? `${window.location.origin}/result/archive/${archiveItemId}`
            : ""
        }
        shareTitle={(
          archiveListTitleTrim ||
          reportMainHeadline ||
          "FAITH 검증 결과"
        ).trim()}
      />
    </div>
  );
}
