// CDA ფრონტენდი: ჩვეულებრივი JavaScript, ეხმიანება /api-ს. ინლაინ სტილები არ გამოიყენება (CSP style-src 'self')
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { user: null, pending: null, lessons: [], done: new Set(), scores: {}, cfg: { plans: [], payInfo: '', contact: '', mentor: '' }, tab: 'orders', loaded: false };
const fmtDate = t => new Date(t).toLocaleDateString('ka-GE');

async function api(path, data) {
  const r = await fetch('/api/' + path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'შეცდომა');
  return j;
}
let tt;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3200); }

// მინიმალური Markdown (ჯერ ესკეიპი, მერე ფორმატირება): ## სათაური, - სია, **მუქი**, `კოდი`, ``` ბლოკი ```
function md(src) {
  const inline = t => t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  let out = '', list = false, code = false, buf = [];
  for (const ln of esc(src).split('\n')) {
    if (ln.startsWith('```')) { if (code) { out += '<pre><code>' + buf.join('\n') + '</code></pre>'; buf = []; code = false; } else { if (list) { out += '</ul>'; list = false; } code = true; } continue; }
    if (code) { buf.push(ln); continue; }
    if (ln.startsWith('- ')) { if (!list) { out += '<ul>'; list = true; } out += '<li>' + inline(ln.slice(2)) + '</li>'; continue; }
    if (list) { out += '</ul>'; list = false; }
    if (ln.startsWith('## ')) out += '<h3>' + inline(ln.slice(3)) + '</h3>';
    else if (ln.trim()) out += '<p>' + inline(ln) + '</p>';
  }
  return out + (list ? '</ul>' : '');
}
// YouTube/Vimeo ბმულების გადაყვანა embed-ად (მენტორს ჩვეულებრივი ბმულის ჩასმაც შეუძლია)
function embed(u) {
  try {
    const x = new URL(u), h = x.hostname.replace(/^www\./, ''), id = /^[\w-]{6,20}$/;
    if (h === 'youtu.be' && id.test(x.pathname.slice(1))) return 'https://www.youtube-nocookie.com/embed/' + x.pathname.slice(1);
    if (['youtube.com', 'm.youtube.com'].includes(h) && x.pathname === '/watch' && id.test(x.searchParams.get('v') || '')) return 'https://www.youtube-nocookie.com/embed/' + x.searchParams.get('v');
    if (['youtube.com', 'youtube-nocookie.com'].includes(h) && /^\/embed\/[\w-]{6,20}$/.test(x.pathname)) return 'https://www.youtube-nocookie.com' + x.pathname;
    if (h === 'vimeo.com' && /^\/\d+$/.test(x.pathname)) return 'https://player.vimeo.com/video' + x.pathname;
    if (h === 'player.vimeo.com' && /^\/video\/\d+/.test(x.pathname)) return u;
  } catch {}
  return null;
}

const plans = () => S.cfg.plans, planOf = id => plans().find(p => p.id === id) || plans()[0] || { name: '', price: 0 };
const level = () => S.user ? S.user.level : 0;
async function load() {
  S.cfg = await api('config');
  const me = await api('me'); S.user = me.user; S.pending = me.pending || null;
  const d = await api('lessons'); S.lessons = d.lessons; S.done = new Set(d.done); S.scores = d.scores || {}; S.loaded = true;
}
const unlocked = () => S.lessons.filter(l => !l.locked);
const pct = () => S.lessons.length ? Math.round(S.done.size / S.lessons.length * 100) : 0;
const weeks = () => { const m = {}; S.lessons.forEach(l => (m[l.week] ||= []).push(l)); return m; };
const currentTheme = () => document.documentElement.getAttribute('data-theme');
const lockIco = () => '<svg class="ico" viewBox="0 0 16 16" role="img" aria-label="დაკეტილია"><path fill="currentColor" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5H6V4.5a2 2 0 1 1 4 0V6Z"/></svg>';
const bar = p => `<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i data-w="${p}"></i></div>`;

function nav() {
  const h = location.hash || '#/', on = p => h.startsWith('#/' + p) ? 'on' : '';
  const u = S.user;
  $('#nav').innerHTML = `<a class="${on('course')}" href="#/course">კურსი</a><a class="${on('pricing')}" href="#/pricing">ფასი</a>` +
    (u ? `<a class="${on('qa')}" href="#/qa">მენტორი</a><a class="${on('account')}" href="#/account">ანგარიში</a>${u.role === 'admin' ? `<a class="${on('admin')}" href="#/admin">ადმინი</a>` : ''}<button id="out">გასვლა</button>`
       : `<a class="${on('login')}" href="#/login">შესვლა</a><a class="cta" href="#/register">რეგისტრაცია</a>`) +
    `<button class="theme" id="th" aria-label="${currentTheme() === 'dark' ? 'ღია თემა' : 'მუქი თემა'}" title="თემის შეცვლა">${currentTheme() === 'dark' ? 'ღია' : 'მუქი'}</button>`;
  const o = $('#out'); if (o) o.onclick = async () => { await api('logout', {}); location.hash = '#/'; await boot(); };
  $('#th').onclick = () => {
    const t = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('cda-theme', t); } catch {}
    nav();
  };
}
function foot() {
  const c = S.cfg.contact;
  $('#foot').innerHTML = `<div><p><b>CDA</b> Cyber &amp; Digital Academy. Learn. Build. Secure.</p>${c ? `<p>კონტაქტი: ${esc(c)}</p>` : ''}</div>
    <div class="links"><a href="#/course">კურსი</a><a href="#/pricing">ფასი</a><a href="#/terms">წესები და პირობები</a><a href="#/privacy">კონფიდენციალურობა</a></div>
    <p class="fine">CDA-ს სერტიფიკატი არის კურსის დასრულების დოკუმენტი და არ ცვლის სახელმწიფოს მიერ აღიარებულ კვალიფიკაციას.</p>`;
}

const planCard = (p, cur) => {
  const isCur = S.user && cur === p.id, free = p.id === 'free';
  let btn;
  if (isCur) btn = `<button class="btn ${p.popular ? 'white' : 'line'}" disabled>შენი მიმდინარე გეგმა</button>`;
  else if (free) btn = `<a class="btn line" href="${S.user ? '#/course' : '#/register'}">დაიწყე უფასოდ</a>`;
  else if (!S.user) btn = `<a class="btn ${p.popular ? 'white' : ''}" href="#/register">დარეგისტრირდი</a>`;
  else btn = `<button class="btn ${p.popular ? 'white' : ''}" data-plan="${p.id}">${S.pending === p.id ? 'განაცხადი გაგზავნილია' : 'აირჩიე ' + esc(p.name)}</button>`;
  return `<div class="plan ${p.popular ? 'pop' : ''}">${p.popular ? '<span class="pill">პოპულარული</span>' : ''}<h3>${esc(p.name)}</h3><p class="tg">${esc(p.tagline)}</p>
    <div class="price">${p.price} ₾ <small>${p.price ? '/ თვეში' : ''}</small></div><ul class="ck">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>${btn}</div>`;
};

// კვირების ბარათები: ყოველი გაკვეთილი პირდაპირი ბმულია
const weekCards = () => `<div class="wk">${Object.entries(weeks()).map(([w, ls]) => {
  const d = ls.filter(l => S.done.has(l.id)).length, lk = ls[0].locked;
  const st = lk ? lockIco() + ' დაკეტილია' : S.user ? d + '/' + ls.length : ls[0].free ? 'უფასო' : '';
  return `<div class="wcard"><div class="k"><span>კვირა ${w}</span><span class="st">${st}</span></div><h3>${esc(ls[0].summary)}</h3>
    <ul>${ls.map(l => `<li><span class="dot ${S.done.has(l.id) ? 'd' : ''}">${S.done.has(l.id) ? '✓' : ''}</span><a href="#/lesson/${l.id}">${esc(l.title)}</a></li>`).join('')}</ul></div>`;
}).join('')}</div>`;

const views = {
  home: () => `<section class="hero"><div><h1>ისწავლე ციფრული უნარები შენს ტემპში</h1>
    <p class="lead">ვიდეოგაკვეთილები, ტექსტური მასალა, ქვიზები, პრაქტიკული დავალებები და მენტორი, რომელიც კითხვებზე გპასუხობს. დამწყებებისა და სკოლის მოსწავლეებისთვის.</p>
    <div class="row"><a class="btn" href="${S.user ? '#/course' : '#/register'}">${S.user ? 'განაგრძე სწავლა' : 'დაიწყე უფასოდ'}</a><a class="btn line" href="#/pricing">ფასი</a></div>
    <ul class="facts"><li>8 კვირა</li><li>${S.lessons.length} გაკვეთილი</li><li>პირველი კვირა უფასოა</li><li>სწავლა საკუთარ ტემპში</li></ul></div>
    <div class="term" aria-hidden="true"><div class="bar"><i></i><i></i><i></i></div><pre><code><span class="p">$</span> whoami\nstudent\n<span class="p">$</span> cat plan.txt\n<span class="m">8 კვირა, ${S.lessons.length} გაკვეთილი</span>\n<span class="m">Linux, ქსელები, Python, OSINT</span>\n<span class="p">$</span> ./start --week 1\n<span class="m">კვირა 1 უფასოა</span>\n<span class="p">$</span> <span class="cur"></span></code></pre></div></section>
    <section class="sec"><header><h2>როგორ მიმდინარეობს სწავლა</h2><p>ყოველი გაკვეთილი ერთი და იგივე რიტმით მიდის.</p></header>
    <ol class="steps"><li><b>წაიკითხე და უყურე</b><p>გაკვეთილის ტექსტი, ვიდეო და PDF კონსპექტი.</p></li><li><b>შეამოწმე</b><p>სწრაფი ქვიზი ყოველი გაკვეთილის შემდეგ, ავტომატური შეფასებით.</p></li><li><b>გააკეთე</b><p>პრაქტიკული დავალება უსაფრთხო, კანონიერ გარემოში.</p></li><li><b>იკითხე</b><p>მენტორი პასუხობს კითხვებს და აფასებს დავალებებს.</p></li></ol></section>
    <section class="sec"><header><h2>8 კვირის გეგმა</h2><p>ნულიდან პირველ პროექტამდე.</p></header>${weekCards()}</section>
    <section class="sec full"><header><h2>აირჩიე გეგმა</h2><p>დაიწყე უფასოდ. გადახდილ გეგმას ნებისმიერ დროს შეცვლი.</p></header><div class="plans">${plans().map(p => planCard(p, S.user && S.user.plan)).join('')}</div></section>
    <section class="sec"><header><h2>მენტორი</h2></header><div class="mentor"><img src="img/logo.png" alt=""><div><h3>${S.cfg.mentor ? esc(S.cfg.mentor) : 'შენი მენტორი'}</h3><p>კურსი ისე არის აგებული, რომ დამწყებმაც გაიგოს: მარტივი ენა, პრაქტიკული მაგალითები და ყოველთვის კანონიერი, უსაფრთხო ვარჯიში. კითხვებს პირადად ვპასუხობ.</p></div></div></section>
    <section class="sec"><header><h2>ხშირი შეკითხვები</h2></header><div class="faq">
    <details><summary>წინასწარი ცოდნა მჭირდება?</summary><p>არა. კურსი იწყება ნულიდან: კომპიუტერი, ქსელები, შემდეგ უსაფრთხოება.</p></details>
    <details><summary>როგორ ვიხდი ფულს?</summary><p>აირჩევ გეგმას, გაგიგზავნით გადახდის რეკვიზიტებს, გადახდის შემდეგ მენტორი წვდომას ხელით გაგიხსნის (ჩვეულებრივ რამდენიმე საათში).</p></details>
    <details><summary>შემიძლია გეგმის გაუქმება?</summary><p>დიახ. გეგმა 30 დღით აქტიურდება და ავტომატურად არ განახლდება: გაგრძელება შენზეა დამოკიდებული.</p></details>
    <details><summary>არასრულწლოვანს შეუძლია სწავლა?</summary><p>დიახ, მშობლის ან მეურვის თანხმობით. გადახდასა და რეგისტრაციაზე მშობელი უნდა იყოს ინფორმირებული.</p></details>
    <details><summary>ჰაკერობას ვისწავლი?</summary><p>ვსწავლობთ დაცვას და უსაფრთხო პრაქტიკას. სხვის სისტემაზე უნებართვო ქმედება კანონით დასჯადია და კურსში არ მოიაზრება.</p></details>
    <details><summary>რა მოხდება, თუ პაროლი დამავიწყდა?</summary><p>მოწერე მენტორს: ის დროებით პაროლს გამოგიგზავნის, შემდეგ ანგარიშის გვერდზე შეცვლი.</p></details></div></section>
    <section class="sec"><header><h2>მიმართულებები</h2></header><div class="dirs"><div class="wcard now"><div class="k"><span>ახლა ხელმისაწვდომია</span></div><h3>Cybersecurity</h3><p>ქსელები, Linux, უსაფრთხოების პრინციპები.</p></div>
    ${['Programming', 'Web Development', 'Digital Design'].map(x => `<div class="wcard soon"><div class="k"><span>მალე</span></div><h3>${x}</h3><p>კურსი მზადდება.</p></div>`).join('')}</div></section>`,

  course: () => {
    const nx = unlocked().find(l => !S.done.has(l.id)) || S.lessons[0] || {};
    return `<h1 class="s">Cybersecurity: Beginner Path</h1><p class="lead">8 კვირა, ${S.lessons.length} გაკვეთილი. პირველი კვირა უფასოა, დანარჩენისთვის საჭიროა გეგმა.</p>
    ${S.user ? `<div class="panel"><b>პროგრესი: ${pct()}%</b> (${S.done.size}/${S.lessons.length})${bar(pct())}<div class="row"><a class="btn" href="#/lesson/${nx.id}">${S.done.size ? 'განაგრძე: ' + esc(nx.title) : 'დაიწყე პირველი გაკვეთილი'}</a>${level() >= 2 && S.done.size === S.lessons.length && S.lessons.length ? '<a class="btn dark" href="#/certificate">სერტიფიკატი</a>' : ''}</div></div><p></p>` : `<div class="row"><a class="btn" href="#/lesson/${nx.id}">დაიწყე პირველი გაკვეთილი</a><a class="btn line" href="#/register">შექმენი ანგარიში პროგრესის შესანახად</a></div>`}
    ${weekCards()}`;
  },

  lesson: id => {
    const l = S.lessons.find(x => x.id == id) || S.lessons[0]; if (!l) return '<p>იტვირთება…</p>';
    const idx = S.lessons.indexOf(l), next = S.lessons[idx + 1], prev = S.lessons[idx - 1];
    const side = Object.entries(weeks()).map(([w, ls]) => `<h4>კვირა ${w}: ${esc(ls[0].summary)}</h4>` + ls.map(x => `<a class="li ${x.id === l.id ? 'on' : ''}" href="#/lesson/${x.id}" ${x.id === l.id ? 'aria-current="page"' : ''}><span class="dot ${S.done.has(x.id) ? 'd' : ''}">${S.done.has(x.id) ? '✓' : ''}</span>${esc(x.title)}${x.locked ? lockIco() : ''}</a>`).join('')).join('');
    const head = `<div class="lh"><div><a class="crumb" href="#/course">კვირა ${l.week}: ${esc(l.summary)}</a><h2>${esc(l.title)}</h2></div>
      <div class="pn">${prev ? `<a class="btn line sm" href="#/lesson/${prev.id}">წინა</a>` : ''}${next ? `<a class="btn line sm" href="#/lesson/${next.id}">შემდეგი</a>` : ''}</div></div>`;
    let main;
    if (l.locked) main = `${head}<div class="note"><p><b>ეს გაკვეთილი გადახდილი გეგმის მფლობელებისთვისაა.</b></p><p>Start გეგმა (${planOf('start').price} ₾ / თვე) გიხსნის კურსის ყველა გაკვეთილს.</p></div><div class="row"><a class="btn" href="#/pricing">გეგმების ნახვა</a>${S.user ? '' : '<a class="btn line" href="#/register">რეგისტრაცია</a>'}</div>`;
    else {
      const em = l.video_url && embed(l.video_url);
      const player = !l.video_url ? '' : em ? `<div class="player"><iframe src="${esc(em)}" title="${esc(l.title)}" allow="fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : `<div class="player"><video controls preload="metadata" src="${esc(l.video_url)}"></video></div>`;
      const sc = S.scores[l.id];
      const rail = `${l.task ? `<div class="task"><h3>დავალება</h3><p>${esc(l.task)}</p></div>` : ''}
        ${level() >= 2 ? `<details><summary>გაუგზავნე დავალება მენტორს</summary><textarea id="tk" rows="5" maxlength="4000" placeholder="ჩაწერე შენი პასუხი ან ჩასვი ბმული" aria-label="დავალების პასუხი"></textarea><div class="row"><button class="btn sm" id="tks">გაგზავნა შესაფასებლად</button></div></details>`
          : S.user ? `<p class="why">დავალების გაგზავნა და მენტორის შეფასება Pro და Mentor გეგმებშია. <a href="#/pricing"><u>გეგმები</u></a></p>` : ''}
        ${l.bonus ? `<div class="bonus"><h3>ბონუსი</h3>${md(l.bonus)}</div>` : l.bonus_locked ? `<div class="bonus"><h3>ბონუსი ${lockIco()}</h3><p>ბონუს ლაბები და შპარგალკები Pro გეგმაშია. <a href="#/pricing"><u>გეგმები</u></a></p></div>` : ''}
        <div class="row">${S.user ? `<button class="btn sm" id="dn">${S.done.has(l.id) ? 'მონიშვნის მოხსნა' : 'დავასრულე გაკვეთილი'}</button>` : '<a class="btn sm" href="#/login">შედი პროგრესის შესანახად</a>'}
        <a class="btn line sm" href="#/qa/${l.id}">დაუსვი კითხვა მენტორს</a></div>`;
      main = `${head}${player}<div class="body"><div><div class="prose">${md(l.content)}</div>${l.pdf_url ? `<div class="row"><a class="btn line sm" href="${esc(l.pdf_url)}" target="_blank" rel="noopener noreferrer">PDF კონსპექტი</a></div>` : ''}</div><aside class="rail" aria-label="დავალება და მოქმედებები">${rail}</aside></div>
      ${l.quiz.length ? `<form class="quiz" id="qz"><h3>ქვიზი${sc ? ` <span class="badge">საუკეთესო: ${sc[0]}/${sc[1]}</span>` : ''}</h3>${S.user ? '' : '<p class="why">შედი ანგარიშში, რომ პასუხები შეიმოწმო.</p>'}
        <div class="qs2">${l.quiz.map((x, i) => `<fieldset class="qq"><legend>${i + 1}. ${esc(x.q)}</legend>${x.o.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}" required>${esc(o)}</label>`).join('')}<div class="why" id="w${i}"></div></fieldset>`).join('')}</div>
        <button class="btn sm" id="qb">შემოწმება</button> <span id="qr" role="status"></span></form>` : ''}
      <div class="row">${next ? `<a class="btn" href="#/lesson/${next.id}">შემდეგი გაკვეთილი: ${esc(next.title)}</a>` : '<a class="btn" href="#/course">კურსის გვერდი</a>'}</div>
      ${S.user && S.user.role === 'admin' ? `<div class="adm"><h3>ადმინი: მასალის ბმულები</h3><label for="vu">ვიდეო (https; YouTube/Vimeo ჩვეულებრივი ბმულიც ვარგა)</label><input id="vu" value="${esc(l.video_url)}"><label for="pu">PDF (https)</label><input id="pu" value="${esc(l.pdf_url)}"><div class="row"><button class="btn sm dark" id="sv">შენახვა</button></div></div>` : ''}`;
    }
    return `<div class="lay"><aside class="side" aria-label="კურსის სია"><b>პროგრესი: ${pct()}%</b>${bar(pct())}${side}</aside><section>${main}</section></div>`;
  },

  pricing: () => `<h1 class="s">ფასი</h1><p class="lead">აირჩიე შენთვის შესაფერისი გეგმა. თითოეული 30 დღით აქტიურდება და ავტომატურად არ განახლდება. ფასები საცდელია და შეიძლება შეიცვალოს.</p>
    ${S.user ? `<p>შენი გეგმა: <b>${esc(planOf(S.user.plan).name)}</b>${S.user.plan_expires && S.user.plan !== 'free' ? ` (მოქმედებს ${fmtDate(S.user.plan_expires)}-მდე)` : ''}</p>` : ''}
    ${S.pending ? `<div class="note"><p><b>განაცხადი გაგზავნილია: ${esc(planOf(S.pending).name)}.</b></p><p>${S.cfg.payInfo ? esc(S.cfg.payInfo) : 'მენტორი დაგიკავშირდება და გადახდის რეკვიზიტებს გამოგიგზავნის. გადახდის დადასტურების შემდეგ წვდომა გაიხსნება.'}</p></div>` : ''}
    <div class="plans">${plans().map(p => planCard(p, S.user && S.user.plan)).join('')}</div>
    <div class="note"><p>ონლაინ გადახდა ჯერ არ არის ჩართული: წვდომას მენტორი ხელით გაგიხსნის გადახდის შემდეგ. არასრულწლოვნებისთვის საჭიროა მშობლის თანხმობა.</p></div>`,

  auth: reg => `<form class="form" id="af"><h1 class="s">${reg ? 'რეგისტრაცია' : 'შესვლა'}</h1>
    ${reg ? '<label for="n">სახელი</label><input id="n" autocomplete="name" required minlength="2" maxlength="60">' : ''}
    <label for="e">ელფოსტა</label><input id="e" type="email" autocomplete="email" required maxlength="120">
    <label for="p">პაროლი${reg ? ' (მინ. 8 სიმბოლო)' : ''}</label><div class="pw"><input id="p" type="password" autocomplete="${reg ? 'new' : 'current'}-password" minlength="${reg ? 8 : 1}" maxlength="200" required><button type="button" id="pt" aria-label="პაროლის ჩვენება">ჩვენება</button></div>
    ${reg ? '<label class="chk"><input type="checkbox" id="tm" required><span>ვეთანხმები <a href="#/terms"><u>წესებს</u></a> და <a href="#/privacy"><u>კონფიდენციალურობის პოლიტიკას</u></a>. თუ 18 წელს ქვემოთ ვარ, მშობელს/მეურვეს თანხმობა აქვს.</span></label>' : ''}
    <div class="err" id="er" role="alert"></div><button class="btn block">${reg ? 'შექმენი ანგარიში' : 'შესვლა'}</button>
    <p class="center">${reg ? 'უკვე გაქვს ანგარიში? <a href="#/login"><u>შესვლა</u></a>' : 'ახალი ხარ? <a href="#/register"><u>რეგისტრაცია</u></a>. პაროლი თუ დაგავიწყდა, მოწერე მენტორს.'}</p></form>`,

  qa: lid => !S.user ? views.auth(false) : level() < 1 ? `<h1 class="s">მენტორი</h1><div class="note"><p><b>კითხვების დასმა Start გეგმიდან არის ხელმისაწვდომი.</b></p><p>გეგმის გააქტიურების შემდეგ მენტორი 48 საათში გიპასუხებს (Pro-ზე 24 საათში).</p></div><a class="btn" href="#/pricing">გეგმები</a>` : (() => {
    const l = S.lessons.find(x => x.id == lid);
    return `<h1 class="s">მენტორი</h1><p class="lead">პასუხს ${level() >= 2 ? '24' : '48'} საათში მიიღებ (სამუშაო დღეებში). პირადი მონაცემები არ გამოგვიგზავნო.</p>
    ${l ? `<p><span class="badge">გაკვეთილი: ${esc(l.title)}</span></p>` : ''}
    <div class="qa-box"><textarea id="qt" rows="3" maxlength="800" placeholder="რა გაუგებარია?" aria-label="კითხვა"></textarea><div class="row"><button class="btn" id="qs">გაგზავნა</button></div><div id="ql"></div></div>`; })(),

  account: () => !S.user ? views.auth(false) : `<h1 class="s">ანგარიში</h1><div class="acct">
    <div class="panel"><h2>${esc(S.user.name)}</h2><p>${esc(S.user.email)}</p>
    <p>გეგმა: <b>${esc(planOf(S.user.plan).name)}</b>${S.user.plan_expires && S.user.plan !== 'free' ? `, მოქმედებს ${fmtDate(S.user.plan_expires)}-მდე` : ''}${S.user.role === 'admin' ? ' (ადმინი)' : ''}</p>
    <p>პროგრესი: ${S.done.size}/${S.lessons.length} (${pct()}%)</p>${bar(pct())}
    <div class="row"><a class="btn sm" href="#/pricing">გეგმის შეცვლა</a>${level() >= 2 ? '<a class="btn dark sm" href="#/certificate">სერტიფიკატი</a>' : ''}</div></div>
    <div class="panel"><h2>პაროლის შეცვლა</h2><form class="f" id="pf"><label for="op">ძველი პაროლი</label><input id="op" type="password" autocomplete="current-password" required>
    <label for="np">ახალი პაროლი (მინ. 8 სიმბოლო)</label><input id="np" type="password" autocomplete="new-password" minlength="8" maxlength="200" required><div class="err" id="er" role="alert"></div><button class="btn sm">შეცვლა</button></form></div>
    <div class="panel"><h2>უსაფრთხოება</h2><p>თუ სხვა მოწყობილობაზე დარჩი შესული, გამოდი ყველგან.</p><div class="row"><button class="btn line sm" id="lo">გასვლა ყველა მოწყობილობიდან</button></div></div>
    ${S.user.role === 'admin' ? '' : `<div class="panel danger"><h2>ანგარიშის წაშლა</h2><p>წაიშლება შენი პროფილი, პროგრესი, ქვიზის შედეგები და კითხვები. ეს ქმედება შეუქცევადია.</p>
    <form class="f" id="df"><label for="dp">პაროლი დასადასტურებლად</label><input id="dp" type="password" autocomplete="current-password" required><div class="err" id="er2" role="alert"></div><button class="btn dark sm">სამუდამოდ წაშლა</button></form></div>`}</div>`,

  certificate: () => `<div id="cert"><p>იტვირთება…</p></div>`,

  admin: () => `<h1 class="s">ადმინისტრატორი</h1><div class="stats" id="st"></div>
    <div class="tabs" role="tablist">${[['orders', 'განაცხადები'], ['users', 'მოსწავლეები'], ['qs', 'კითხვები და დავალებები']].map(([k, n]) => `<button role="tab" class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div><div id="ad"></div>`,

  notfound: () => `<h1 class="s">გვერდი ვერ მოიძებნა</h1><p class="lead">ეს მისამართი არ არსებობს ან გადატანილია.</p><div class="row"><a class="btn" href="#/">მთავარი გვერდი</a><a class="btn line" href="#/course">კურსი</a></div>`,

  terms: () => `<h1 class="s">წესები და პირობები</h1><div class="prose">${md(`## ზოგადი
CDA (Cyber & Digital Academy) არის ონლაინ საგანმანათლებლო სერვისი. რეგისტრაციით ეთანხმები ამ წესებს.

## ანგარიში
- ანგარიში პირადია, მისი გაზიარება დაუშვებელია.
- პაროლის უსაფრთხოებაზე პასუხისმგებელი ხარ.
- არასრულწლოვნის რეგისტრაციისთვის საჭიროა მშობლის ან მეურვის თანხმობა.

## გეგმები და გადახდა
- გეგმა აქტიურდება გადახდის დადასტურების შემდეგ 30 დღით და ავტომატურად არ განახლდება.
- თანხის დაბრუნება განიხილება ინდივიდუალურად, მენტორთან დაკავშირებით.

## მასალის გამოყენება
- კურსის მასალა მხოლოდ პირადი სწავლისთვისაა; ვიდეოების, ტექსტებისა და PDF-ების გავრცელება აკრძალულია.

## ეთიკა
- კურსში ნასწავლი უნარები უნდა გამოიყენო მხოლოდ კანონიერად: საკუთარ სისტემებზე ან წერილობითი ნებართვით.
- სხვის სისტემაზე ან ანგარიშზე უნებართვო წვდომა კანონით დასჯადია.

## სერტიფიკატი
CDA-ს სერტიფიკატი არის კურსის დასრულების დოკუმენტი და არ ცვლის სახელმწიფოს მიერ აღიარებულ კვალიფიკაციას.

## შენიშვნა
ეს ტექსტი საწყისი ნიმუშია. გამოქვეყნებამდე გადაამოწმებინე იურისტს.`)}</div>`,

  privacy: () => `<h1 class="s">კონფიდენციალურობა</h1><div class="prose">${md(`## რას ვინახავთ
- სახელს, ელფოსტას და პაროლის დაშიფრულ ჰეშს (თავად პაროლს არა);
- სწავლის პროგრესს, ქვიზის შედეგებს, შენს კითხვებს და გაგზავნილ დავალებებს;
- გეგმას და მის ვადას.

## რისთვის
მხოლოდ სწავლის სერვისის მისაწოდებლად: ავტორიზაცია, პროგრესი, მენტორთან კომუნიკაცია.

## რას არ ვაკეთებთ
- მონაცემებს მესამე მხარეს არ ვყიდით;
- სარეკლამო თვალთვალს არ ვიყენებთ.

## Cookie
ვიყენებთ ერთ აუცილებელ cookie-ს ავტორიზაციისთვის და ბრაუზერში ვინახავთ შენს თემის არჩევანს (ღია/მუქი).

## შენი უფლებები
ანგარიშის გვერდზე შეგიძლია ანგარიში და მასთან დაკავშირებული მონაცემები თავად წაშალო. მონაცემების ასლის მისაღებად მიმართე მენტორს.

## შენიშვნა
ეს ტექსტი საწყისი ნიმუშია. გამოქვეყნებამდე გადაამოწმებინე იურისტს, განსაკუთრებით არასრულწლოვანთა მონაცემების დამუშავების ნაწილში.`)}</div>`
};

const TITLES = { course: 'კურსი', pricing: 'ფასი', login: 'შესვლა', register: 'რეგისტრაცია', qa: 'მენტორი', account: 'ანგარიში', admin: 'ადმინი', certificate: 'სერტიფიკატი', terms: 'წესები და პირობები', privacy: 'კონფიდენციალურობა' };

async function route() {
  nav(); const [p, a] = (location.hash || '#/').slice(2).split('/'); const app = $('#app');
  const adminOnly = p === 'admin' && !(S.user && S.user.role === 'admin');
  let title = TITLES[p] || '';
  if (!S.loaded && p !== 'terms' && p !== 'privacy') app.innerHTML = '<p>იტვირთება…</p>';
  else if (p === 'lesson') { app.innerHTML = views.lesson(a); const l = S.lessons.find(x => x.id == a) || S.lessons[0]; if (l) title = l.title; }
  else if (p === 'login' || p === 'register') app.innerHTML = S.user ? views.account() : views.auth(p === 'register');
  else if (adminOnly) app.innerHTML = '<p>მხოლოდ ადმინისთვის.</p>';
  else if (p && !views[p]) { app.innerHTML = views.notfound(); title = 'გვერდი ვერ მოიძებნა'; }
  else app.innerHTML = views[p || 'home'](a);
  document.title = (title ? title + ' — ' : '') + 'CDA';
  $$('[data-w]').forEach(e => { e.style.width = e.dataset.w + '%'; });
  foot(); scrollTo(0, 0); app.focus({ preventScroll: true }); bind(p, a);
}

function bind(p, a) {
  const af = $('#af');
  if (af) {
    af.onsubmit = async e => { e.preventDefault(); try {
      await api(p === 'register' ? 'register' : 'login', { name: $('#n')?.value, email: $('#e').value, password: $('#p').value, terms: $('#tm') ? $('#tm').checked : undefined });
      await boot('#/course'); } catch (x) { $('#er').textContent = x.message; } };
    $('#pt').onclick = () => { const i = $('#p'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('#pt').textContent = show ? 'დამალვა' : 'ჩვენება'; };
  }
  $$('[data-plan]').forEach(b => b.onclick = async () => { try { await api('orders', { plan: b.dataset.plan }); S.pending = b.dataset.plan; toast('განაცხადი გაიგზავნა'); location.hash = '#/pricing'; route(); } catch (x) { toast(x.message); } });
  const dn = $('#dn');
  if (dn) dn.onclick = async () => { const l = S.lessons.find(x => x.id == a) || S.lessons[0];
    try { const d = !S.done.has(l.id); await api('progress', { lesson_id: l.id, done: d }); d ? S.done.add(l.id) : S.done.delete(l.id); route(); toast(d ? 'გაკვეთილი დასრულებულია' : 'მონიშვნა მოიხსნა'); } catch (x) { toast(x.message); } };
  const sv = $('#sv');
  if (sv) sv.onclick = async () => { const l = S.lessons.find(x => x.id == a) || S.lessons[0]; try { await api('admin/lesson', { id: l.id, video_url: $('#vu').value.trim(), pdf_url: $('#pu').value.trim() }); await load(); toast('შენახულია'); route(); } catch (x) { toast(x.message); } };
  const qz = $('#qz');
  if (qz) qz.onsubmit = async e => { e.preventDefault(); if (!S.user) { location.hash = '#/login'; return; }
    const l = S.lessons.find(x => x.id == a) || S.lessons[0];
    const answers = l.quiz.map((_, i) => +(qz.querySelector(`input[name=q${i}]:checked`) || {}).value);
    try { const r = await api('quiz', { lesson_id: l.id, answers });
      l.quiz.forEach((x, i) => { const rs = r.results[i];
        qz.querySelectorAll(`input[name=q${i}]`).forEach(inp => { const lab = inp.closest('.opt'); lab.classList.remove('ok', 'bad'); if (+inp.value === rs.correct) lab.classList.add('ok'); else if (inp.checked) lab.classList.add('bad'); });
        $('#w' + i).textContent = (rs.ok ? '✓ ' : '✗ ') + rs.e; });
      $('#qr').textContent = `შედეგი: ${r.score}/${r.total}`; S.scores[l.id] = [Math.max(r.score, (S.scores[l.id] || [0])[0]), r.total]; toast(`ქვიზი: ${r.score}/${r.total}`);
    } catch (x) { toast(x.message); } };
  const tks = $('#tks');
  if (tks) tks.onclick = async () => { const t = $('#tk').value.trim(); if (!t) return; try { await api('questions', { text: t, kind: 'task', lesson_id: +a || S.lessons[0].id }); toast('დავალება გაიგზავნა'); location.hash = '#/qa'; } catch (x) { toast(x.message); } };
  if (p === 'qa' && S.user && level() >= 1) { loadQ(); $('#qs').onclick = async () => { const t = $('#qt').value.trim(); if (!t) return; try { await api('questions', { text: t, lesson_id: +a || undefined }); $('#qt').value = ''; toast('კითხვა გაიგზავნა'); loadQ(); } catch (x) { toast(x.message); } }; }
  const pf = $('#pf');
  if (pf) pf.onsubmit = async e => { e.preventDefault(); try { await api('password', { old: $('#op').value, next: $('#np').value }); pf.reset(); $('#er').textContent = ''; toast('პაროლი შეიცვალა'); } catch (x) { $('#er').textContent = x.message; } };
  const lo = $('#lo');
  if (lo) lo.onclick = async () => { try { await api('logout_all', {}); toast('გახვედი ყველა მოწყობილობიდან'); location.hash = '#/login'; await boot(); } catch (x) { toast(x.message); } };
  const df = $('#df');
  if (df) df.onsubmit = async e => { e.preventDefault(); if (!confirm('ანგარიში და მისი მონაცემები სამუდამოდ წაიშლება. გაგრძელება?')) return;
    try { await api('account/delete', { password: $('#dp').value }); toast('ანგარიში წაიშალა'); location.hash = '#/'; await boot(); } catch (x) { $('#er2').textContent = x.message; } };
  if (p === 'certificate') loadCert();
  if (p === 'admin' && S.user?.role === 'admin') { $$('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); loadAdmin(); }); loadAdmin(); }
}

async function loadCert() {
  try { const c = await api('certificate');
    $('#cert').innerHTML = `<div class="cert"><img src="img/logo.png" alt="" width="56"><p><b>CDA — Cyber &amp; Digital Academy</b></p><h1>სერტიფიკატი</h1><p>ამით ადასტურებს, რომ</p><div class="nm">${esc(c.name)}</div><p>წარმატებით გაიარა კურსი</p><p><b>Cybersecurity: Beginner Path</b></p><p>8 კვირა, ${S.lessons.length} გაკვეთილი, შემაჯამებელი პროექტი</p><p><small>თარიღი: ${fmtDate(c.date)}. ნომერი: ${esc(c.id)}</small></p></div>
    <div class="row noprint"><button class="btn" id="pr">ბეჭდვა / PDF-ად შენახვა</button></div>`;
    $('#pr').onclick = () => print();
  } catch (x) { $('#cert').innerHTML = `<h1 class="s">სერტიფიკატი</h1><div class="note"><p>${esc(x.message)}</p></div><a class="btn" href="#/pricing">გეგმები</a>`; }
}

async function loadQ() {
  const { questions } = await api('questions'), admin = S.user.role === 'admin';
  const html = questions.length ? questions.map(q => `<div class="q"><small>${admin ? esc(q.name) + ', ' : ''}${fmtDate(q.created)}</small>${q.kind === 'task' ? '<span class="badge t">დავალება</span>' : ''}${admin && q.plan !== 'free' ? `<span class="badge">${esc(planOf(q.plan).name)}</span>` : ''}${q.lesson_title ? `<span class="badge">${esc(q.lesson_title)}</span>` : ''}<p>${esc(q.text)}</p>
    ${q.answer ? `<div class="a"><b>მენტორი:</b> ${esc(q.answer)}</div>` : admin ? `<div class="row"><textarea id="a${q.id}" rows="2" placeholder="პასუხი" aria-label="პასუხი"></textarea><button class="btn sm" data-id="${q.id}">პასუხი</button></div>` : '<small>პასუხი მალე იქნება</small>'}</div>`).join('') : '<p>ჯერ არაფერია. დასვი პირველი კითხვა.</p>';
  const box = $('#ql') || $('#ad'); if (!box) return; box.innerHTML = html;
  $$('[data-id]').forEach(b => b.onclick = async () => { try { await api('admin/answer', { id: +b.dataset.id, answer: $('#a' + b.dataset.id).value }); loadQ(); } catch (x) { toast(x.message); } });
}

async function loadAdmin() {
  const [s, o] = await Promise.all([api('admin/stats'), api('admin/orders')]);
  $('#st').innerHTML = [['მოსწავლე', s.users], ['გადამხდელი', plans().filter(p => p.level).reduce((n, p) => n + (s.by[p.id] || 0), 0)], ['თვიური შემოსავალი', s.mrr + ' ₾'], ['ახალი განაცხადი', s.orders], ['უპასუხო', s.open]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  const box = $('#ad');
  if (S.tab === 'qs') return loadQ();
  if (S.tab === 'orders') {
    box.innerHTML = o.orders.length ? `<div class="scroll"><table><tr><th>სახელი</th><th>ელფოსტა</th><th>გეგმა</th><th>თარიღი</th><th></th></tr>${o.orders.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${esc(planOf(x.plan).name)} (${planOf(x.plan).price} ₾)</td><td>${fmtDate(x.created)}</td><td><button class="btn sm" data-o="${x.id}" data-act="approve">დადასტურება (30 დღე)</button> <button class="btn sm line" data-o="${x.id}" data-act="reject">უარყოფა</button></td></tr>`).join('')}</table></div><p class="why">დადასტურება გეგმას მომხმარებელს 30 დღით ააქტიურებს. გააკეთე ეს გადახდის მიღების შემდეგ.</p>` : '<p>ახალი განაცხადები არ არის.</p>';
    $$('[data-o]').forEach(b => b.onclick = async () => { try { await api('admin/order', { id: +b.dataset.o, action: b.dataset.act }); toast('შესრულდა'); loadAdmin(); } catch (x) { toast(x.message); } });
    return;
  }
  const { users } = await api('admin/users'); const draw = f => {
    const list = users.filter(u => !f || (u.name + u.email).toLowerCase().includes(f.toLowerCase()));
    $('#ut').innerHTML = `<tr><th>სახელი</th><th>ელფოსტა</th><th>გეგმა</th><th>ვადა</th><th></th></tr>` + list.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><select data-pl="${u.id}" aria-label="გეგმა">${plans().map(p => `<option value="${p.id}" ${p.id === u.plan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
      <td>${u.plan !== 'free' ? (u.plan_expires ? fmtDate(u.plan_expires) + (u.plan_expires < Date.now() ? ' (ვადაგასული)' : '') : 'უვადო') : '—'}</td>
      <td><input class="d" type="number" min="0" max="3650" value="30" data-d="${u.id}" aria-label="დღეები"> <button class="btn sm" data-u="${u.id}">შენახვა</button> <button class="btn sm line" data-r="${u.id}">პაროლი</button></td></tr>`).join('');
    $$('[data-u]').forEach(b => b.onclick = async () => { try { await api('admin/plan', { id: +b.dataset.u, plan: $(`[data-pl="${b.dataset.u}"]`).value, days: +$(`[data-d="${b.dataset.u}"]`).value }); toast('შენახულია'); loadAdmin(); } catch (x) { toast(x.message); } });
    $$('[data-r]').forEach(b => b.onclick = async () => { if (!confirm('პაროლი შეიცვლება და მომხმარებელი გამოვა სისტემიდან. გაგრძელება?')) return; try { const r = await api('admin/resetpw', { id: +b.dataset.r }); prompt('დროებითი პაროლი (გადაეცი მოსწავლეს და სთხოვე შეცვლა):', r.password); } catch (x) { toast(x.message); } });
  };
  box.innerHTML = `<label for="sf" class="why">ძებნა</label><input id="sf" class="search" placeholder="სახელი ან ელფოსტა"><div class="scroll"><table id="ut"></table></div>`;
  $('#sf').oninput = e => draw(e.target.value); draw('');
}

async function boot(go) { try { await load(); } catch (e) { toast('სერვერთან კავშირი ვერ დამყარდა'); } S.loaded = true; if (go) location.hash = go; route(); }
addEventListener('hashchange', route);
boot();
