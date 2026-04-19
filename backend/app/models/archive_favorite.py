from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, TIMESTAMP, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.sql import Base


class ArchiveFavorite(Base):
    """회원이 아카이브 항목에 찜(하트)한 기록."""

    __tablename__ = "archive_favorites"
    __table_args__ = (
        UniqueConstraint(
            "member_id",
            "archive_item_id",
            name="uq_archive_fav_member_item",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("members.member_id", ondelete="CASCADE"),
        nullable=False,
    )
    archive_item_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("archive_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
