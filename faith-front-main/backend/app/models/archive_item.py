from datetime import datetime
from sqlalchemy import BigInteger, ForeignKey, Numeric, String, Text, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.sql import Base


class ArchiveItem(Base):
    """사용자가 결과 화면에서 「아카이브 저장」을 눌렀을 때만 기록되는 공개 목록용 항목."""

    __tablename__ = "archive_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("members.member_id", ondelete="SET NULL"), nullable=True
    )

    category_key: Mapped[str] = mapped_column(String(20), nullable=False)
    category_label: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    risk_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    risk_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    risk_category: Mapped[str | None] = mapped_column(String(80), nullable=True)

    author_name: Mapped[str] = mapped_column(String(80), nullable=False)
    result_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
