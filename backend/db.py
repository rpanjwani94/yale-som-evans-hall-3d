"""Read-only access to the Yale SOM course catalog (data/yale_som.db)."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "yale_som.db"

# columns a professor needs to answer schedule questions; descriptions are trimmed in list results
LIST_COLS = "course_number, section, course_title, faculty_1, course_category, course_session, timings_day, timings_start, timings_end, room"
SEARCH_FIELDS = ["course_number", "course_title", "course_description", "faculty_1", "course_category", "course_type"]


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)  # mode=ro: the agents can never change the catalog
    con.row_factory = sqlite3.Row
    return con


def _rows(sql: str, args: tuple = ()) -> list[dict]:
    with connect() as con:
        return [{k: v for k, v in dict(r).items() if v not in (None, "")} for r in con.execute(sql, args)]


def search_courses(query: str, limit: int = 8) -> list[dict]:
    """Every word in the query must appear in at least one searchable field."""
    words = [w for w in query.split() if w][:6]
    if not words:
        return []
    where = " AND ".join("(" + " OR ".join(f"{f} LIKE ?" for f in SEARCH_FIELDS) + ")" for _ in words)
    args = tuple(f"%{w}%" for w in words for _ in SEARCH_FIELDS)
    sql = f"SELECT {LIST_COLS}, substr(course_description, 1, 280) AS description FROM courses WHERE {where} ORDER BY course_number, section LIMIT ?"
    return _rows(sql, args + (max(1, min(limit, 20)),))


def get_course(course_number: str) -> list[dict]:
    """All sections of one course, with the full description and syllabus link."""
    num = " ".join(course_number.upper().split())
    sql = f"SELECT {LIST_COLS}, units, course_type, course_description, syllabus FROM courses WHERE upper(course_number) = ? ORDER BY section"
    return _rows(sql, (num,))


def courses_by_faculty(name: str) -> list[dict]:
    """Courses taught by anyone whose name matches (names are stored 'Last, First')."""
    parts = [p for p in name.replace(",", " ").split() if p]
    if not parts:
        return []
    where = " AND ".join("faculty_1 LIKE ?" for _ in parts)
    sql = f"SELECT {LIST_COLS} FROM courses WHERE {where} ORDER BY course_number, section LIMIT 30"
    return _rows(sql, tuple(f"%{p}%" for p in parts))


def faculty_bio(name: str) -> str:
    parts = [p for p in name.replace(",", " ").split() if p]
    if not parts:
        return ""
    where = " AND ".join("faculty_1 LIKE ?" for _ in parts)
    rows = _rows(f"SELECT faculty_1, faculty_bio FROM courses WHERE {where} AND faculty_bio <> '' LIMIT 1", tuple(f"%{p}%" for p in parts))
    return f"{rows[0]['faculty_1']}: {rows[0]['faculty_bio']}" if rows else ""


def courses_in_room(room: str) -> list[dict]:
    """Courses meeting in a room, e.g. '2200' or 'EVANS 2200'."""
    sql = f"SELECT {LIST_COLS} FROM courses WHERE room LIKE ? ORDER BY timings_day, timings_start LIMIT 40"
    return _rows(sql, (f"%{room.strip()}%",))


def categories() -> list[dict]:
    return _rows("SELECT course_category, count(*) AS courses FROM courses GROUP BY course_category ORDER BY courses DESC")
