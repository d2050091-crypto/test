# ადმინის შექმნა/დანიშვნა პირდაპირ ბაზაში:
#   python3 make_admin.py ელფოსტა პაროლი [სახელი]
# თუ ანგარიში უკვე არსებობს, ის ადმინი გახდება და პაროლი შეიცვლება.
import re
import secrets
import sys
import time

import db
from server import hash_pw

args = sys.argv[1:]
email = args[0] if len(args) > 0 else ''
password = args[1] if len(args) > 1 else ''
name = args[2] if len(args) > 2 else 'მენტორი'
if not email or not re.fullmatch(r'\S+@\S+\.\S+', email) or len(password) < 8:
    sys.exit('გამოყენება: python3 make_admin.py ელფოსტა პაროლი(მინ. 8 სიმბოლო) [სახელი]')
e, salt = email.strip().lower(), secrets.token_hex(16)
h = hash_pw(password, salt)
if db.one('SELECT 1 FROM users WHERE email=?', e):
    db.run("UPDATE users SET role='admin',hash=?,salt=? WHERE email=?", h, salt, e)
    db.run('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)', e)
    print(f'ანგარიში {e} ახლა ადმინია, პაროლი შეცვლილია.')
else:
    db.run("INSERT INTO users(email,name,hash,salt,role,created) VALUES(?,?,?,?,'admin',?)", e, name[:60], h, salt, int(time.time() * 1000))
    print(f'ადმინი შეიქმნა: {e}')
