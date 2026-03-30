from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Literal, List

RiskCategoryKO = Literal["혐오/폭력", "딥페이크", "금융 사기", "허위정보", "성적 콘텐츠", "정상"]

@dataclass
class UserContext:
    is_logged_in: bool = False
    age: Optional[int] = None
    gender: str = "other"

@dataclass
class AgentResult:
    agent: str
    score01: float
    category: RiskCategoryKO
    reason: str
    raw: Dict[str, Any]

@dataclass
class AgentReason:
    """에이전트별 근거"""
    agent: str          # 에이전트 이름 (Gemini, Groq, HuggingFace)
    score: int          # 0~100 점수
    reason: str         # 근거 문장

@dataclass
class CategoryReason:
    """카테고리별 그룹핑된 근거"""
    category: RiskCategoryKO                                    # 카테고리
    avg_score: int                                              # 해당 카테고리 평균 점수
    agents: List[AgentReason] = field(default_factory=list)    # 해당 카테고리로 판단한 에이전트들

@dataclass
class FinalResult:
    risk_score: int
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    risk_category: RiskCategoryKO
    reasons_by_category: List[CategoryReason] = field(default_factory=list)
