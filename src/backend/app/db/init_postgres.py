from pathlib import Path
from sqlalchemy import text
from app.db.sql import engine


SQL_DIR = Path(__file__).resolve().parent / "postgres"

ORDER = [
    "capstone_db.sql",
    "members.sql",
    "user_profile.sql",
    "risk_detail.sql",
    "verification_history.sql",
]

def run_sql_file(path: Path):
    sql = path.read_text(encoding="utf-8")
    
    with engine.begin() as conn:
        conn.execute(text(sql))

def init_postgres():
    for fname in ORDER:
        fpath = SQL_DIR / fname
        if fpath.exists():
            run_sql_file(fpath)
