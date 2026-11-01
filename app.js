(function () {
  const KEY = 'ibtikari-savings-v1';
  const $ = s => document.querySelector(s);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => L.ymd(new Date());
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let state = load();
  let tab = 'home';
  let reportScope = 'month';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return L.defaultState(today(), uid);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 2200);
  }

  /* ---------- نافذة الإدخال ---------- */
  function openSheet(html) {
    $('#sheet').innerHTML = html;
    $('#sheet').hidden = false; $('#bg').hidden = false;
    const first = $('#sheet input'); if (first) setTimeout(() => first.focus(), 60);
  }
  function closeSheet() { $('#sheet').hidden = true; $('#bg').hidden = true; $('#sheet').innerHTML = ''; }
  $('#bg').addEventListener('click', closeSheet);

  /* ---------- الشاشات ---------- */
  function render() {
    $('#topDate').textContent = new Date().toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const c = L.compute(state, today());
    const v = $('#view');
    v.innerHTML = ({ home: homeView, spend: spendView, jam: jamView, report: reportView }[tab])(c);
  }

  function homeView(c) {
    const monthNow = L.ym(new Date());
    const monthSpend = L.sum(state.spend.filter(x => x.date.slice(0, 7) === monthNow).map(x => x.amount));
    const next = c.nextOpen;
    let notice = '';
    if (c.noFreeMonths) notice = `<div class="notice">كل الأشهر الباقية محددة يدويًا، وناقص ${fmt(c.shortfall)} ريال للوصول للهدف.</div>`;
    else if (c.shortfall > 0) notice = `<div class="notice">بالخطة الحالية هتوصل لـ ${fmt(c.projected)} ريال، يعني ناقص ${fmt(c.shortfall)}.</div>`;
    return `
    <div class="card">
      <div class="muted">معاك للمصروف دلوقتي</div>
      <div class="big" style="color:${c.wallet < 0 ? 'var(--red)' : 'var(--ink)'}">${fmt(c.wallet)}<small>ريال</small></div>
      <div class="muted" style="margin-top:6px">صرفت الشهر ده ${fmt(monthSpend)} ريال</div>
      <div class="btns" style="margin-top:14px">
        <button class="btn" data-act="addSpend">سجّل مصروف</button>
        <button class="btn ghost" data-act="addTopup">زوّد رصيد</button>
      </div>
    </div>

    ${notice}

    <div class="card">
      <div class="row"><h2 style="margin:0">هدف ${fmt(state.goal)} ريال</h2><span class="pill">${c.pct.toFixed(0)}٪</span></div>
      <div class="bar"><i style="width:${c.pct}%"></i></div>
      <div class="row"><span>اللي اتشال</span><span class="num">${fmt(c.saved)}</span></div>
      <div class="row"><span>الباقي</span><span class="num">${fmt(c.remaining)}</span></div>
      <div class="row"><span class="muted">لحد ${new Date(state.deadline + 'T00:00:00').toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })}</span><span class="muted">فاضل ${c.daysLeft} يوم</span></div>
    </div>

    ${next ? `
    <div class="card">
      <div class="muted">قسط الجمعية الجاي: ${esc(next.label)}</div>
      <div class="big" style="font-size:30px">${fmt(next.planned)}<small>ريال</small></div>
      <div class="muted" style="margin:4px 0 12px">يتحول يوم ${new Date(next.payday + 'T00:00:00').toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' })}، أول ما القبض ينزل</div>
      <button class="btn ghost" data-act="payJam" data-ym="${next.ym}">حوّلت القسط</button>
    </div>` : ''}

    <div class="btns">
      <button class="btn ghost" data-act="addSaving">إضافة للادخار</button>
      <button class="btn ghost" data-act="withdraw">سحب طارئ</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>آخر حركات الادخار</h2>
      <ul class="list">${[...state.savings].reverse().slice(0, 6).map(x => `
        <li><div><div>${esc(x.note || (x.amount < 0 ? 'سحب' : 'إضافة'))}</div><div class="sub">${x.date}</div></div>
        <div class="num" style="color:${x.amount < 0 ? 'var(--red)' : 'var(--green)'}">${x.amount < 0 ? '−' : '+'}${fmt(Math.abs(x.amount))}</div></li>`).join('') || '<li class="muted">لسه مفيش</li>'}</ul>
    </div>

    <div class="btns" style="margin-top:6px">
      <button class="btn ghost small" data-act="backup">نسخة احتياطية</button>
      <button class="btn ghost small" data-act="settings">الإعدادات</button>
    </div>`;
  }

  function spendView() {
    const list = [...state.spend].reverse().slice(0, 40);
    return `
    <button class="btn" data-act="addSpend" style="margin-bottom:14px">سجّل مصروف</button>
    <div class="card">
      <h2>آخر المصروفات</h2>
      <ul class="list">${list.map(x => `
        <li><div><div>${esc(x.cat)}${x.note ? ' · ' + esc(x.note) : ''}</div><div class="sub">${x.date}</div></div>
        <div style="display:flex;align-items:center;gap:4px"><span class="num">−${fmt(x.amount)}</span><button class="x" data-act="delSpend" data-id="${x.id}" aria-label="حذف">✕</button></div></li>`).join('') || '<li class="muted">لسه ماسجلتش أي مصروف</li>'}</ul>
    </div>
    ${state.topups.length ? `<div class="card"><h2>الرصيد اللي اتزود</h2><ul class="list">${[...state.topups].reverse().slice(0, 10).map(x => `
      <li><div><div>${esc(x.note || 'زيادة رصيد')}</div><div class="sub">${x.date}</div></div><span class="num" style="color:var(--green)">+${fmt(x.amount)}</span></li>`).join('')}</ul></div>` : ''}`;
  }

  function jamView(c) {
    return `
    <div class="card">
      <h2>الجمعية الوهمية</h2>
      <p class="muted" style="margin:0">كل قبض بتحوّل قسطك لحساب الادخار، كأنك ملتزم قدام ناس. المبلغ بيتحسب لوحده عشان توصل للهدف.</p>
    </div>
    ${c.rows.map(r => `
      <div class="month ${r.paid ? 'done' : ''}">
        <div>
          <div class="nm">${esc(r.label)}</div>
          <div class="sub muted">${r.paid ? 'اتحوّل ✓' : 'القبض يوم ' + new Date(r.payday + 'T00:00:00').getDate()}</div>
        </div>
        <div style="text-align:left">
          <div class="num">${fmt(r.planned)}</div>
          ${r.paid ? '' : `<button class="btn small" data-act="payJam" data-ym="${r.ym}" style="margin-top:6px">حوّلت</button>`}
        </div>
      </div>`).join('')}
    <div class="card">
      <div class="row"><span>القسط الشهري المطلوب</span><span class="num">${fmt(c.perMonth)}</span></div>
      <div class="row"><span>المتوقع توصله</span><span class="num">${fmt(c.projected)}</span></div>
      <button class="btn ghost small" data-act="overrides" style="margin-top:12px">عدّل مبلغ شهر معين</button>
    </div>`;
  }

  function reportView() {
    const ym = reportScope === 'month' ? L.ym(new Date()) : null;
    const r = L.byCat(state.spend, ym);
    return `
    <div class="chips">
      <button class="chip ${reportScope === 'month' ? 'on' : ''}" data-act="scope" data-v="month">الشهر ده</button>
      <button class="chip ${reportScope === 'all' ? 'on' : ''}" data-act="scope" data-v="all">من البداية</button>
    </div>
    <div class="card">
      <div class="muted">إجمالي المصروف (${r.count} عملية)</div>
      <div class="big">${fmt(r.total)}<small>ريال</small></div>
    </div>
    <div class="card">
      <h2>حسب النوع</h2>
      ${r.rows.map(x => `
        <div class="cat"><div class="top2"><span>${esc(x.cat)}</span><span class="num">${fmt(x.amount)} · ${x.pct.toFixed(0)}٪</span></div>
        <div class="bar"><i style="width:${x.pct}%"></i></div></div>`).join('') || '<div class="muted">مفيش مصروفات في الفترة دي</div>'}
    </div>`;
  }

  /* ---------- الإجراءات ---------- */
  const actions = {
    addSpend() {
      let cat = L.CATS[0];
      openSheet(`
        <h3>مصروف جديد</h3>
        <label>المبلغ</label>
        <input id="amt" class="amount" type="number" inputmode="decimal" placeholder="0">
        <label>النوع</label>
        <div class="chips" id="cats">${L.CATS.map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
        <label>ملاحظة (اختياري)</label>
        <input id="note" type="text" placeholder="مثلًا: غدا">
        <button class="btn" id="ok">حفظ</button>`);
      $('#cats').addEventListener('click', e => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        cat = b.dataset.cat;
        $('#cats').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
      });
      $('#ok').onclick = () => {
        const amount = parseFloat($('#amt').value);
        if (!(amount > 0)) return toast('اكتب المبلغ');
        state.spend.push({ id: uid(), date: today(), amount, cat, note: $('#note').value.trim() });
        save(); closeSheet(); render();
        const left = L.compute(state, today()).wallet;
        toast(`اتسجّل. فاضل معاك ${fmt(left)} ريال`);
      };
    },
    addTopup() {
      openSheet(`
        <h3>زيادة رصيد المصروف</h3>
        <label>المبلغ</label>
        <input id="amt" class="amount" type="number" inputmode="decimal" placeholder="0">
        <label>ملاحظة (اختياري)</label>
        <input id="note" type="text" placeholder="مثلًا: مصروف الشهر">
        <button class="btn" id="ok">حفظ</button>`);
      $('#ok').onclick = () => {
        const amount = parseFloat($('#amt').value);
        if (!(amount > 0)) return toast('اكتب المبلغ');
        state.topups.push({ id: uid(), date: today(), amount, note: $('#note').value.trim() });
        save(); closeSheet(); render(); toast('اتزاد الرصيد');
      };
    },
    addSaving() {
      openSheet(`
        <h3>إضافة للادخار</h3>
        <label>المبلغ</label>
        <input id="amt" class="amount" type="number" inputmode="decimal" placeholder="0">
        <label>ملاحظة (اختياري)</label>
        <input id="note" type="text" placeholder="مثلًا: باقي الشهر">
        <button class="btn" id="ok">حفظ</button>`);
      $('#ok').onclick = () => {
        const amount = parseFloat($('#amt').value);
        if (!(amount > 0)) return toast('اكتب المبلغ');
        state.savings.push({ id: uid(), date: today(), amount, note: $('#note').value.trim() || 'إضافة', month: null });
        save(); closeSheet(); render(); toast('اتضاف للادخار');
      };
    },
    withdraw() {
      openSheet(`
        <h3>سحب طارئ من الادخار</h3>
        <p class="muted" style="margin-top:0">للطوارئ الحقيقية بس. المبلغ هيتخصم من الهدف.</p>
        <label>المبلغ</label>
        <input id="amt" class="amount" type="number" inputmode="decimal" placeholder="0">
        <label>السبب</label>
        <input id="note" type="text" placeholder="السبب">
        <button class="btn danger" id="ok">تأكيد السحب</button>`);
      $('#ok').onclick = () => {
        const amount = parseFloat($('#amt').value);
        if (!(amount > 0)) return toast('اكتب المبلغ');
        state.savings.push({ id: uid(), date: today(), amount: -amount, note: $('#note').value.trim() || 'سحب طارئ', month: null });
        save(); closeSheet(); render(); toast('اتسجّل السحب');
      };
    },
    payJam(el) {
      const ym = el.dataset.ym;
      const row = L.compute(state, today()).rows.find(r => r.ym === ym);
      openSheet(`
        <h3>قسط ${esc(row.label)}</h3>
        <label>المبلغ اللي حوّلته</label>
        <input id="amt" class="amount" type="number" inputmode="decimal" value="${row.planned}">
        <button class="btn" id="ok">تم التحويل</button>`);
      $('#ok').onclick = () => {
        const amount = parseFloat($('#amt').value);
        if (!(amount > 0)) return toast('اكتب المبلغ');
        state.savings.push({ id: uid(), date: today(), amount, note: 'قسط الجمعية ' + row.label, month: ym });
        save(); closeSheet(); render(); toast('عاش! القسط اتسجّل');
      };
    },
    overrides() {
      const c = L.compute(state, today());
      const open = c.rows.filter(r => !r.paid);
      openSheet(`
        <h3>مبلغ كل شهر</h3>
        <p class="muted" style="margin-top:0">اكتب مبلغ للشهر اللي عايزه ثابت (زي نوفمبر). سيب الخانة فاضية والتطبيق يحسبه.</p>
        ${open.map(r => `<label>${esc(r.label)}</label><input type="number" inputmode="decimal" data-ym="${r.ym}" value="${state.overrides[r.ym] != null ? state.overrides[r.ym] : ''}" placeholder="يتحسب تلقائي">`).join('')}
        <button class="btn" id="ok">حفظ</button>`);
      $('#ok').onclick = () => {
        $('#sheet').querySelectorAll('input[data-ym]').forEach(i => {
          const v = parseFloat(i.value);
          if (v >= 0) state.overrides[i.dataset.ym] = v; else delete state.overrides[i.dataset.ym];
        });
        save(); closeSheet(); render();
      };
    },
    settings() {
      openSheet(`
        <h3>الإعدادات</h3>
        <label>الهدف (ريال)</label>
        <input id="goal" type="number" inputmode="decimal" value="${state.goal}">
        <label>تاريخ الهدف</label>
        <input id="dl" type="date" value="${state.deadline}">
        <label>رصيد المصروف في البداية</label>
        <input id="ow" type="number" inputmode="decimal" value="${state.openingWallet}">
        <button class="btn" id="ok">حفظ</button>
        <button class="btn danger" id="reset" style="margin-top:10px">مسح كل البيانات</button>`);
      $('#ok').onclick = () => {
        const g = parseFloat($('#goal').value), d = $('#dl').value, w = parseFloat($('#ow').value);
        if (g > 0) state.goal = g;
        if (d) state.deadline = d;
        if (w >= 0) state.openingWallet = w;
        save(); closeSheet(); render(); toast('اتحفظت الإعدادات');
      };
      $('#reset').onclick = () => {
        if (confirm('متأكد؟ كل البيانات هتتمسح.')) {
          state = L.defaultState(today(), uid); save(); closeSheet(); render();
        }
      };
    },
    backup() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ibtikari-backup-${today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('اتحمّلت النسخة الاحتياطية');
    },
    delSpend(el) {
      if (!confirm('تحذف المصروف ده؟')) return;
      state.spend = state.spend.filter(x => x.id !== el.dataset.id);
      save(); render();
    },
    scope(el) { reportScope = el.dataset.v; render(); }
  };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (t && actions[t.dataset.act]) actions[t.dataset.act](t);
  });
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab; window.scrollTo(0, 0); render();
  });

  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
