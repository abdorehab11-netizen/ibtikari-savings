/* منطق الحسابات - بدون أي اعتماد على الواجهة، عشان نقدر نختبره لوحده */
(function (root) {
  const L = {};

  L.MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  L.CATS = ['أكل وشرب', 'بنزين', 'عربية', 'ترفيه', 'ملابس', 'أخرى'];

  L.pad = n => String(n).padStart(2, '0');
  L.ymd = d => `${d.getFullYear()}-${L.pad(d.getMonth() + 1)}-${L.pad(d.getDate())}`;
  L.ym = d => `${d.getFullYear()}-${L.pad(d.getMonth() + 1)}`;
  L.sum = arr => arr.reduce((a, b) => a + (Number(b) || 0), 0);

  L.monthLabel = ym => {
    const [y, m] = ym.split('-').map(Number);
    return `${L.MONTH_NAMES[m - 1]} ${y}`;
  };

  /* آخر يوم في الشهر = يوم القبض */
  L.payday = ym => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0);
  };

  /* كل الأشهر اللي قبضها بيجي قبل أو في يوم الهدف */
  L.months = (startYm, deadline) => {
    const out = [];
    let [y, m] = startYm.split('-').map(Number);
    for (let i = 0; i < 36; i++) {
      const ym = `${y}-${L.pad(m)}`;
      if (L.ymd(L.payday(ym)) > deadline) break;
      out.push(ym);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return out;
  };

  L.daysBetween = (fromYmd, toYmd) => {
    const a = new Date(fromYmd + 'T00:00:00');
    const b = new Date(toYmd + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  };

  L.defaultState = (todayYmd, uid) => ({
    goal: 30000,
    deadline: '2027-03-01',
    startMonth: '2026-11',
    openingWallet: 700,
    /* الأشهر اللي المبلغ فيها متحدد يدوي (نوفمبر شهر تقيل) */
    overrides: { '2026-11': 5000 },
    savings: [{ id: uid(), date: todayYmd, amount: 1000, note: 'البداية', month: null }],
    topups: [],
    spend: []
  });

  L.compute = (s, todayYmd) => {
    const saved = L.sum(s.savings.map(x => x.amount));
    const remaining = Math.max(0, s.goal - saved);
    const ms = L.months(s.startMonth, s.deadline);

    const paidOf = ym => s.savings.filter(x => x.month === ym);
    const rows = ms.map(ym => {
      const p = paidOf(ym);
      return {
        ym,
        label: L.monthLabel(ym),
        payday: L.ymd(L.payday(ym)),
        paid: p.length > 0,
        paidAmount: L.sum(p.map(x => x.amount)),
        fixed: s.overrides[ym] != null,
        planned: 0
      };
    });

    const open = rows.filter(r => !r.paid);
    const fixedSum = L.sum(open.filter(r => r.fixed).map(r => s.overrides[r.ym]));
    const free = open.filter(r => !r.fixed);
    const rest = Math.max(0, remaining - fixedSum);
    const per = free.length ? Math.ceil(rest / free.length / 50) * 50 : 0;

    rows.forEach(r => {
      if (r.paid) r.planned = r.paidAmount;
      else r.planned = r.fixed ? s.overrides[r.ym] : per;
    });

    const projected = saved + L.sum(open.map(r => r.planned));
    const wallet = (Number(s.openingWallet) || 0)
      + L.sum(s.topups.map(x => x.amount))
      - L.sum(s.spend.map(x => x.amount));

    return {
      saved,
      remaining,
      pct: Math.min(100, Math.max(0, (saved / s.goal) * 100)),
      rows,
      perMonth: per,
      projected,
      shortfall: Math.max(0, s.goal - projected),
      daysLeft: Math.max(0, L.daysBetween(todayYmd, s.deadline)),
      wallet,
      nextOpen: open[0] || null,
      noFreeMonths: free.length === 0 && remaining > fixedSum
    };
  };

  /* تقرير المصروف حسب النوع، ym = شهر معين أو null لكل المدة */
  L.byCat = (spend, ym) => {
    const list = ym ? spend.filter(x => x.date.slice(0, 7) === ym) : spend;
    const total = L.sum(list.map(x => x.amount));
    const map = {};
    list.forEach(x => { map[x.cat] = (map[x.cat] || 0) + Number(x.amount); });
    const rows = Object.entries(map)
      .map(([cat, amount]) => ({ cat, amount, pct: total ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
    return { total, rows, count: list.length };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
  else root.L = L;
})(typeof window !== 'undefined' ? window : this);
