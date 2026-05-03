from typing import Optional
from sqlalchemy import BigInteger, String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.sql import Base


class UserProfile(Base):
    __tablename__ = "user_profile"

    profile_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    member_id: Mapped[int] = mapped_column(
        BigInteger, 
        ForeignKey("members.member_id", ondelete="CASCADE"), 
        nullable=False, 
        unique=True
    )
    age_group: Mapped[Optional[str]] = mapped_column(String(20))
    occupation: Mapped[Optional[str]] = mapped_column(String(50))
    is_risk: Mapped[bool] = mapped_column(Boolean, default=False)

    member = relationship("Member", backref="profile")
