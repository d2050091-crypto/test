# სწრაფი API ტესტი: python3 test_api.py  (იყენებს დროებით ბაზას და სხვა პორტს)
import http.client, json, os, re, sqlite3, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(tempfile.gettempdir(), f'cda-test-{int(time.time() * 1000)}.db')
PORT = 3917
srv = subprocess.Popen([sys.executable, 'server.py'], cwd=HERE,
                       env={**os.environ, 'PORT': str(PORT), 'DB_FILE': DB_FILE, 'ADMIN_EMAIL': 'boss@test.ge'})
PW = 'Tr0ub4dor&3x'
jar, failed = {}, False


def call(who, path, data=None, raw=False, extra=None):
    c = http.client.HTTPConnection('localhost', PORT, timeout=15)
    hd = {'Content-Type': 'application/json'}
    if who in jar:
        hd['Cookie'] = jar[who]
    hd.update(extra or {})
    c.request('GET' if data is None else 'POST', path, None if data is None else json.dumps(data), hd)
    r = c.getresponse(); b = r.read()
    ck = r.getheader('Set-Cookie')
    if ck and re.search(r'sid=[a-f0-9]+', ck):
        jar[who] = ck.split(';')[0]
    if raw:
        return r, b
    try:
        j = json.loads(b)
    except ValueError:
        j = {}
    return {'s': r.status, **j}


def ok(name, fn):
    global failed
    try:
        fn(); print('✓', name)
    except Exception as e:  # noqa: BLE001
        failed = True; print('✗', name, '\n ', repr(e))


def eq(a, b):
    assert a == b, f'{a!r} != {b!r}'


for _ in range(80):
    try:
        call('x', '/api/config'); break
    except OSError:
        time.sleep(0.1)


def reg(who, email):
    return call(who, '/api/register', {'name': 'ტესტი ' + who, 'email': email, 'password': PW, 'terms': True})


ok('რეგისტრაცია წესებზე თანხმობის გარეშე იგდება', lambda: eq(call('x', '/api/register', {'name': 'აა', 'email': 'a@b.ge', 'password': PW})['s'], 400))
reg('boss', 'boss@test.ge'); reg('stu', 'stu@test.ge')
ok('ადმინი ADMIN_EMAIL-ით', lambda: eq(call('boss', '/api/me')['user']['role'], 'admin'))


def t_free():
    d = call('stu', '/api/lessons'); L = d['lessons']
    l1 = next(l for l in L if l['week'] == 1); l3 = next(l for l in L if l['week'] == 3)
    eq(len(L), 16); assert len(l1['content']) > 200 and not l1['locked']
    assert l3['locked'] and not l3.get('content') and not l3.get('quiz') and not l3.get('video_url')
    assert '"a"' not in json.dumps(l1['quiz']), 'სწორი პასუხები არ უნდა გაიგზავნოს'
ok('უფასო მომხმარებელი: კვირა 1 ღია, კვირა 2 დაბლოკილი და შიგთავსი დამალული', t_free)


def t_quiz():
    l = call('stu', '/api/lessons')['lessons'][0]
    eq(call('stu', '/api/quiz', {'lesson_id': l['id'], 'answers': [1, 2, 0]})['score'], 3)
    eq(call('stu', '/api/quiz', {'lesson_id': l['id'], 'answers': [0, 0, 1]})['score'], 0)
    eq(call('stu', '/api/lessons')['scores'][str(l['id'])], [3, 3])
ok('ქვიზი ფასდება სერვერზე', t_quiz)


def t_noask():
    eq(call('stu', '/api/questions', {'text': 'გამარჯობა'})['s'], 403)
    eq(call('stu', '/api/questions', {'text': 'ა', 'kind': 'task', 'lesson_id': 1})['s'], 403)
ok('უფასო ვერ სვამს კითხვას და ვერ აგზავნის დავალებას', t_noask)


def t_locked():
    l = next(l for l in call('stu', '/api/lessons')['lessons'] if l['week'] == 3)
    eq(call('stu', '/api/progress', {'lesson_id': l['id'], 'done': True})['s'], 403)
    eq(call('stu', '/api/quiz', {'lesson_id': l['id'], 'answers': [0, 0, 0]})['s'], 403)
ok('დაბლოკილ გაკვეთილზე პროგრესი/ქვიზი აკრძალულია', t_locked)


def t_order():
    eq(call('stu', '/api/orders', {'plan': 'start'})['s'], 200); eq(call('stu', '/api/orders', {'plan': 'hack'})['s'], 400)
    eq(call('stu', '/api/admin/orders')['s'], 403)
    o = call('boss', '/api/admin/orders')['orders']; eq(len(o), 1)
    eq(call('boss', '/api/admin/order', {'id': o[0]['id'], 'action': 'approve'})['s'], 200)
    me = call('stu', '/api/me'); eq(me['user']['plan'], 'start'); assert me['user']['plan_expires'] > time.time() * 1000
    assert not any(l['locked'] for l in call('stu', '/api/lessons')['lessons'])
    eq(call('stu', '/api/questions', {'text': 'კითხვა'})['s'], 200)
ok('შეკვეთა → ადმინი ადასტურებს → წვდომა იხსნება', t_order)


def t_pro():
    l = call('stu', '/api/lessons')['lessons'][0]; eq(l['bonus'], ''); assert l['bonus_locked']
    eq(call('stu', '/api/questions', {'text': 'ჩემი პასუხი', 'kind': 'task', 'lesson_id': l['id']})['s'], 403)
    u = next(x for x in call('boss', '/api/admin/users')['users'] if x['email'] == 'stu@test.ge')
    eq(call('boss', '/api/admin/plan', {'id': u['id'], 'plan': 'pro', 'days': 30})['s'], 200)
    l = call('stu', '/api/lessons')['lessons'][0]; assert len(l['bonus']) > 10
    eq(call('stu', '/api/questions', {'text': 'ჩემი პასუხი', 'kind': 'task', 'lesson_id': l['id']})['s'], 200)
ok('Start-ზე ბონუსი და დავალების გაგზავნა დაკეტილია, Pro-ზე იხსნება', t_pro)


def t_expired():
    d = sqlite3.connect(DB_FILE); d.execute("UPDATE users SET plan_expires=1 WHERE email='stu@test.ge'"); d.commit(); d.close()
    eq(call('stu', '/api/me')['user']['plan'], 'free')
    u = next(x for x in call('boss', '/api/admin/users')['users'] if x['email'] == 'stu@test.ge')
    call('boss', '/api/admin/plan', {'id': u['id'], 'plan': 'pro', 'days': 30})
ok('ვადაგასული გეგმა = უფასო', t_expired)


def t_cert():
    eq(call('stu', '/api/certificate')['s'], 403)
    for l in call('stu', '/api/lessons')['lessons']:
        call('stu', '/api/progress', {'lesson_id': l['id'], 'done': True})
    c = call('stu', '/api/certificate'); eq(c['s'], 200); assert re.fullmatch(r'CDA-[0-9A-F]{10}', c['id'])
ok('სერტიფიკატი მხოლოდ დასრულების შემდეგ', t_cert)


def t_admin():
    q = call('boss', '/api/questions')['questions']; assert len(q) >= 2 and q[0]['kind']
    eq(call('boss', '/api/admin/answer', {'id': q[0]['id'], 'answer': 'პასუხი'})['s'], 200)
    assert call('boss', '/api/admin/stats')['mrr'] >= 49
    u = next(x for x in call('boss', '/api/admin/users')['users'] if x['email'] == 'stu@test.ge')
    r = call('boss', '/api/admin/resetpw', {'id': u['id']})
    assert call('stu', '/api/me')['user'] is None  # სესია გაუქმდა
    eq(call('stu', '/api/login', {'email': 'stu@test.ge', 'password': r['password']})['s'], 200)
ok('ადმინი: პასუხი, სტატისტიკა, პაროლის გადაყენება', t_admin)


def t_pw():
    eq(call('stu', '/api/password', {'old': 'არასწორი', 'next': 'Another-Pass-77'})['s'], 400)
    eq(call('stu', '/api/password', {'old': '', 'next': 'x'})['s'], 400)
ok('პაროლის შეცვლა', t_pw)


def t_video():
    eq(call('boss', '/api/admin/lesson', {'id': 1, 'video_url': 'javascript:alert(1)'})['s'], 400)
    eq(call('boss', '/api/admin/lesson', {'id': 1, 'video_url': 'https://youtu.be/dQw4w9WgXcQ'})['s'], 200)
ok('ვიდეო ბმული: მხოლოდ https', t_video)


def t_sec():
    r, _ = call('x', '/', raw=True); assert "default-src 'self'" in r.getheader('content-security-policy'); eq(r.getheader('x-frame-options'), 'DENY')
    eq(call('x', '/img/logo.png', raw=True)[0].status, 200)
    eq(call('x', '/img/ar-arsebobs.png', raw=True)[0].status, 404)
    eq(call('x', '/..%2fserver.py', raw=True)[0].status, 404)
    _, b = call('x', '/%2e%2e/%2e%2e/etc/passwd', raw=True); assert b'root:' not in b
    eq(call('x', '/server.py', raw=True)[0].status, 404)
    eq(call('x', '/db.py', raw=True)[0].status, 404)
ok('უსაფრთხოების ჰედერები და სტატიკა', t_sec)


def t_csrf():
    eq(call('x', '/api/login', {'email': 'a@b.ge', 'password': 'x'}, extra={'Origin': 'https://evil.example'})['s'], 403)
    eq(call('x', '/api/login', {'email': 'a@b.ge', 'password': 'x'}, extra={'Origin': f'http://localhost:{PORT}'})['s'], 401)
    eq(call('x', '/api/login', {'email': 'a@b.ge', 'password': 'x'}, extra={'Content-Type': 'text/plain'})['s'], 415)
ok('CSRF: სხვა საიტიდან POST იბლოკება, API მხოლოდ JSON-ს იღებს', t_csrf)


def t_weak():
    r = call('x', '/api/register', {'name': 'აა ბბ', 'email': 'weak@test.ge', 'password': 'password123', 'terms': True})
    eq(r['s'], 400); assert 'მარტივი' in r['error']
ok('ძალიან მარტივი პაროლი იგდება', t_weak)


def t_hdr():
    r, _ = call('x', '/', raw=True)
    assert 'unsafe-inline' not in r.getheader('content-security-policy'); assert "object-src 'none'" in r.getheader('content-security-policy')
    eq(r.getheader('cross-origin-opener-policy'), 'same-origin')
    eq(call('x', '/css/.hidden', raw=True)[0].status, 404)
    eq(call('x', '/.git/config', raw=True)[0].status, 404)
ok('CSP ინლაინ სტილების გარეშე, დამატებითი ჰედერები, დამალული ფაილები', t_hdr)


def t_sessions_hashed():
    d = sqlite3.connect(DB_FILE); toks = [r[0] for r in d.execute('SELECT token FROM sessions')]; d.close()
    assert toks and not any(jar['stu'].endswith(t) for t in toks), 'ტოკენი ბაზაში ღიად არ უნდა ინახებოდეს'
ok('სესიის ტოკენები ბაზაში ჰეშირებულია', t_sessions_hashed)


def t_delete():
    reg('gone', 'gone@test.ge')
    eq(call('gone', '/api/account/delete', {'password': 'არასწორი'})['s'], 400)
    eq(call('gone', '/api/account/delete', {'password': PW})['s'], 200)
    assert call('gone', '/api/me')['user'] is None
    eq(call('gone', '/api/login', {'email': 'gone@test.ge', 'password': PW})['s'], 401)
    eq(call('boss', '/api/account/delete', {'password': PW})['s'], 400)
ok('ანგარიშის წაშლა (ადმინი ვერ იშლება)', t_delete)


def t_logout_all():
    call('stu', '/api/login', {'email': 'stu@test.ge', 'password': PW})
    eq(call('stu', '/api/logout_all', {})['s'], 200)
    assert call('stu', '/api/me')['user'] is None
ok('გასვლა ყველა მოწყობილობიდან', t_logout_all)


def t_rate():
    s = None
    for _ in range(12):
        s = call('x', '/api/login', {'email': 'victim@test.ge', 'password': 'bad'})['s']
    eq(s, 429)
ok('ლოგინის შეზღუდვა', t_rate)

srv.terminate(); srv.wait()
for f in (DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm'):
    try: os.remove(f)
    except OSError: pass
sys.exit(1 if failed else 0)
