from sqlalchemy import BigInteger, String, Numeric, TIMESTAMP, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.sql import Base

class VerificationHistory(Base):
    __tablename__ = "verification_history"

    verification_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    member_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


    input_content: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_detail_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    final_risk_score: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)

    verified_at: Mapped[str] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
