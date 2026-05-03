from typing import Dict, List
from collections import defaultdict
from .schemas import AgentResult, FinalResult, CategoryReason, AgentReason

def clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))

def level_from01(s: float) -> str:
    if s >= 0.67: return "CRITICAL"
    if s >= 0.50: return "HIGH"
    if s >= 0.34: return "MEDIUM"
    return "LOW"

def ensemble(agents: Dict[str, AgentResult]) -> FinalResult:
    AGENT_NAMES = {"gemini": "Gemini", "groq": "Groq", "hf": "HuggingFace"}

    usable = [a for a in agents.values() if a and a.score01 is not None]
    if not usable:
        return FinalResult(
            risk_score=0,
            risk_level="LOW",
            risk_category="정상",
            reasons_by_category=[],
        )

    # 성공한 에이전트 간 균등 평균 (MAS에서 한 모델이 통합 점수를 독점하지 않도록)
    final01 = sum(a.score01 for a in usable) / float(len(usable))
    final01 = clamp01(final01)
    final_score = int(round(final01 * 100))

    sorted_agents = sorted(usable, key=lambda x: x.score01, reverse=True)
    best = sorted_agents[0]

    g = agents.get("gemini")
    if g and g.category == "정상" and g.score01 < 0.34:
        h = agents.get("hf")
        if (h is None) or (h.score01 < 0.34):
            cat = "정상"
        else:
            cat = h.category
    else:
        cat = best.category

    # 카테고리별 그룹핑
    category_groups: Dict[str, List[AgentResult]] = defaultdict(list)
    for agent in usable:
        category_groups[agent.category].append(agent)

    reasons_by_category = []
    for category, agent_list in category_groups.items():
        avg_score = int(round(sum(a.score01 for a in agent_list) / len(agent_list) * 100))

        agent_reasons = []
        for agent in sorted(agent_list, key=lambda x: x.score01, reverse=True):
            reason_text = agent.reason
            if not reason_text or reason_text.strip() == "":
                reason_text = "위험 요소가 감지되지 않았습니다." if agent.category == "정상" else f"'{agent.category}' 관련 위험 요소가 감지되었습니다."
            agent_reasons.append(AgentReason(
                agent=AGENT_NAMES.get(agent.agent, agent.agent),
                score=int(round(agent.score01 * 100)),
                reason=reason_text,
            ))

        reasons_by_category.append(CategoryReason(
            category=category,
            avg_score=avg_score,
            agents=agent_reasons,
        ))

    # 최종 카테고리 우선, 그 다음 평균 점수 높은 순
    reasons_by_category.sort(key=lambda x: (x.category != cat, -x.avg_score))

    return FinalResult(
        risk_score=final_score,
        risk_level=level_from01(final01),
        risk_category=cat,
        reasons_by_category=reasons_by_category,
    )
