# მონაცემთა ბაზა: SQLite (Python-ის ჩაშენებული sqlite3; დამატებითი პაკეტები არ სჭირდება)
# ბაზის ფორმატი იგივეა, რაც Node-ის ვერსიაში: არსებული cda.db უცვლელად მუშაობს.
import json
import os
import sqlite3
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.environ.get('DB_FILE') or os.path.join(HERE, 'cda.db')

_lock = threading.RLock()
_c = sqlite3.connect(DB_FILE, check_same_thread=False, isolation_level=None, timeout=10)
_c.row_factory = sqlite3.Row


def one(sql, *args):
    with _lock:
        r = _c.execute(sql, args).fetchone()
    return dict(r) if r else None


def all_(sql, *args):
    with _lock:
        return [dict(r) for r in _c.execute(sql, args).fetchall()]


def run(sql, *args):
    with _lock:
        return _c.execute(sql, args).rowcount


with _lock:
    _c.executescript("""
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT DEFAULT 'student', plan TEXT DEFAULT 'free', created INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lessons(id INTEGER PRIMARY KEY, week INTEGER, pos INTEGER, title TEXT, summary TEXT, task TEXT, free INTEGER DEFAULT 0, video_url TEXT DEFAULT '', pdf_url TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS progress(user_id INTEGER, lesson_id INTEGER, PRIMARY KEY(user_id,lesson_id));
CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY, user_id INTEGER, lesson_id INTEGER, text TEXT, answer TEXT DEFAULT '', created INTEGER);
CREATE TABLE IF NOT EXISTS quiz_results(user_id INTEGER, lesson_id INTEGER, score INTEGER, total INTEGER, PRIMARY KEY(user_id,lesson_id));
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, plan TEXT NOT NULL, status TEXT DEFAULT 'pending', created INTEGER);
""")


def add_col(table, col, ddl):
    if not any(c['name'] == col for c in all_(f'PRAGMA table_info({table})')):
        run(f'ALTER TABLE {table} ADD COLUMN {col} {ddl}')


# მარტივი მიგრაცია: ძველ ბაზებს აკლია სვეტები
add_col('users', 'plan_expires', 'INTEGER')
add_col('lessons', 'content', "TEXT DEFAULT ''")
add_col('lessons', 'quiz', "TEXT DEFAULT '[]'")
add_col('lessons', 'bonus', "TEXT DEFAULT ''")
add_col('questions', 'kind', "TEXT DEFAULT 'question'")
add_col('progress', 'done_at', 'INTEGER')
with _lock:
    _c.executescript("""
CREATE INDEX IF NOT EXISTS i_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS i_questions_user ON questions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS i_lessons_wp ON lessons(week,pos);
UPDATE users SET plan='start' WHERE plan='active';
""")

# კურსის მასალა იტვირთება/ახლდება content.json-იდან; ადმინის მიერ ჩასმული ვიდეო და PDF ბმულები არ იშლება
with open(os.path.join(HERE, 'content.json'), encoding='utf-8') as f:
    COURSE = json.load(f)

_UPSERT = ('INSERT INTO lessons(week,pos,title,summary,task,free,content,quiz,bonus) VALUES(?,?,?,?,?,?,?,?,?) '
           'ON CONFLICT(week,pos) DO UPDATE SET title=excluded.title, summary=excluded.summary, task=excluded.task, '
           'free=excluded.free, content=excluded.content, quiz=excluded.quiz, bonus=excluded.bonus')
for w in COURSE:
    for j, l in enumerate(w['lessons']):
        run(_UPSERT, w['week'], j + 1, l['title'], w['title'], l['task'], 1 if w['week'] == 1 else 0,
            l['content'], json.dumps(l['quiz'], ensure_ascii=False, separators=(',', ':')), l['bonus'])
