from sqlalchemy import BigInteger, Numeric, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.sql import Base

class RiskDetail(Base):
    __tablename__ = "risk_detail"

    risk_detail_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    verification_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("verification_history.verification_id", ondelete="CASCADE"),
        nullable=False,
    )

    risk_category: Mapped[str] = mapped_column(String(50), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    individual_risk_score: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)

    final_risk_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
