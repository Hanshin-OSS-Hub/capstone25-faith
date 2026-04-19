from datetime import datetime, date
from typing import Optional
from sqlalchemy import BigInteger, String, Date, DateTime, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.sql import Base

class Member(Base):
    __tablename__ = "members"

    member_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    login_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    pw_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    gender: Mapped[Optional[str]] = mapped_column(String(10))
    birth: Mapped[Optional[date]] = mapped_column(Date)

    created: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )