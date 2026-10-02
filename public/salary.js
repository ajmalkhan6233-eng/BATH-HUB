/* Salary module screens: Today, Month, Settings. Loaded by the owner pages; mounts into #sl-tabs and #sl-body. Owner only (the API refuses anyone else). */
const slEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slRs = n => n == null ? 'PENDING' : 'Rs ' + Math.round(Number(n)).toLocaleString('en-US');
let _slTab = 'today';
const SL_FIELDS = [
  ['Monthly split (percent)', [['save_pct', 'Shop savings, % of net profit'], ['colleague_pct', 'Colleague commission, % of the pool'], ['owner_pct', 'Owner commission, % of the pool']]],
  ['Daily costs', [['rent_month', 'Rent per month'], ['utilities_month', 'Water + electricity per month'], ['working_days', 'Working days per month'], ['owner_daily', 'Owner salary per day'], ['colleague_daily', 'Colleague per day'], ['small_daily', 'Small expenses per day (transport, packing...)'], ['cost_normal', 'Normal daily cost target'], ['cost_ceiling', 'Hard ceiling per day'], ['margin_pct', 'Profit margin % (used only when there is no recent sales history)'], ['add_fixed_to_net', 'Subtract rent, bills and daily pay from the month net as well? (1 = yes, 0 = no: they are already on the daily sheet)']]],
  ['Targets', [['push_1', 'Daily sales target 1'], ['push_2', 'Daily sales target 2'], ['cheque_days', 'Cheque set-aside looks this many days ahead']]],
  ['Accessories pricing', [['markup', 'List price = cost x'], ['disc_min', 'Smallest normal discount, %'], ['disc_max', 'Largest normal discount, %'], ['min_over_cost', 'Never sell below cost x']]],
];

function slTabs() {
  document.getElementById('sl-tabs').innerHTML = [['today', 'Today'], ['month', 'Month'], ['settings', 'Settings']].map(([k, l]) =>
    `<button class="btn ${k === _slTab ? 'btn-p' : 'btn-s'}" onclick="_slTab='${k}';loadSalary()">${l}</button>`).join('');
}
const slCard = (title, big, sub, color) => `<div class="card" style="margin-bottom:10px"><div style="font-size:12px;color:var(--text2)">${slEsc(title)}</div><div style="font-size:22px;font-weight:800;${color ? 'color:' + color : ''}">${slEsc(big)}</div>${sub ? `<div style="font-size:12px;color:var(--text2)">${sub}</div>` : ''}</div>`;
const slBar = pct => `<div style="height:8px;background:#8883;border-radius:4px;margin-top:6px"><div style="height:8px;width:${Math.min(100, pct)}%;background:var(--green,#2e7d32);border-radius:4px"></div></div>`;

async function loadSalary() {
  slTabs();
  const body = document.getElementById('sl-body');
  body.innerHTML = '<div class="card no-data">Loading...</div>';
  try {
    if (_slTab === 'today') await slToday(body);
    else if (_slTab === 'month') await slMonth(body);
    else await slSettings(body);
  } catch (e) { body.innerHTML = `<div class="card no-data">${slEsc(e.message)}</div>`; }
}

async function slGet(url) {
  const r = await fetch(url);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 403 ? 'Owner only' : (d.error || 'Could not load'));
  return d;
}

async function slToday(body) {
  const t = await slGet('/api/salary/today');
  const ov = await slGet('/api/salary/overview').catch(() => null);
  const c = t.costs, cs = t.cheque_set_aside;
  const statusTxt = { ok: 'within the normal target', above_normal: 'ABOVE the normal target', over_ceiling: 'OVER the hard ceiling' }[c.status];
  const statusCol = { ok: 'var(--green,#2e7d32)', above_normal: 'var(--amber,#b26a00)', over_ceiling: 'var(--red,#c62828)' }[c.status];
  const cheques = cs.lines.map(l => `<div style="font-size:13px;display:flex;justify-content:space-between;gap:8px;border-top:1px solid #8883;padding:5px 0"><span>${slEsc(l.party || 'Cheque')} · due ${slEsc(l.due_date)}${l.late ? ' <b style="color:var(--red,#c62828)">LATE</b>' : ` · ${l.days_left} day${l.days_left === 1 ? '' : 's'}`}</span><span>${slRs(l.set_aside_today)} <button class="btn btn-s" onclick="slCover(${l.id}, true)">Covered</button></span></div>`).join('');
  body.innerHTML =
    slCard('Sales today', slRs(t.sales), `Gross profit ${slRs(t.gross_profit)} · expenses ${slRs(t.expenses)}`) +
    slCard('Net today', slRs(t.net), t.net == null ? 'PENDING: today\'s profit or expenses are not entered yet' : '') +
    slCard('Daily cost target', slRs(c.total), `Normal ${slRs(c.normal)}, ceiling ${slRs(c.ceiling)}: <b style="color:${statusCol}">${statusTxt}</b><br>Rent ${slRs(c.rent)} + bills ${slRs(c.utilities)} + owner ${slRs(c.owner)} + colleague ${slRs(c.colleague)} + small ${slRs(c.small)}`, statusCol) +
    slCard('Break-even sales', t.break_even_sales == null ? 'unknown' : slRs(t.break_even_sales), `At ${t.margin_pct}% margin (${slEsc(t.settings_used.margin_source)}). ${t.break_even_reached === true ? '<b style="color:var(--green,#2e7d32)">Reached.</b>' : t.break_even_reached === false ? 'Not reached yet.' : ''}`) +
    t.push.map(p => `<div class="card" style="margin-bottom:10px"><div style="font-size:12px;color:var(--text2)">Push target ${slRs(p.target)}</div><div style="font-size:18px;font-weight:700">${p.pct}% · ${p.remaining ? slRs(p.remaining) + ' to go' : 'reached'}</div>${slBar(p.pct)}</div>`).join('') +
    `<div class="card" style="margin-bottom:10px"><div style="font-size:12px;color:var(--text2)">Cheques</div><div style="font-size:18px;font-weight:700">${slEsc(cs.message)}</div>${cs.warning ? `<div style="color:var(--red,#c62828);font-size:13px;margin-top:4px">⚠ ${slEsc(cs.warning)}</div>` : ''}${cheques || '<div style="font-size:13px;color:var(--text2)">No unpaid cheques due soon.</div>'}</div>`;
  if (ov && ov.setup_costs && ov.setup_costs.length) {
    body.innerHTML += '<div class="card" style="margin-bottom:10px"><div style="font-size:12px;color:var(--text2)">One-time set-up costs (not in the daily cost or break-even)</div>' + ov.setup_costs.map(c =>
      `<div style="margin-top:8px"><div style="font-size:18px;font-weight:700">${slEsc(c.label)} (${slEsc(c.status)}): ${slRs(c.amount)}</div><div style="font-size:12px;color:var(--text2)">Paid on ${slEsc(c.paid_on)}</div>` +
      slBar(c.payback.pct) + `<div style="font-size:12px;margin-top:4px">Paid back so far: ${slRs(c.payback.paid_back)} of ${slRs(c.amount)} (${c.payback.pct}%) &middot; <span style="color:var(--text2)">${slEsc(c.payback.note)}</span></div></div>`).join('') + '</div>';
  }
}

async function slCover(id, covered) {
  await fetch('/api/salary/cheque-cover/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ covered }) });
  loadSalary();
}

async function slMonth(body, ym) {
  const cur = ym || (document.getElementById('sl-month') ? document.getElementById('sl-month').value : '') || new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 7);
  const m = await slGet('/api/salary/month?ym=' + encodeURIComponent(cur));
  const row = (l, v, bold) => `<div style="display:flex;justify-content:space-between;padding:4px 0;${bold ? 'font-weight:800;border-top:1px solid #8884;margin-top:4px' : ''}"><span>${l}</span><span>${v}</span></div>`;
  const adj = m.adjustments.map(a => row(`Adjustment from ${slEsc(a.from_month)} (late returns ${slRs(a.late_returns)})`, `- ${slRs(a.colleague + a.owner)}`)).join('');
  const closable = !m.closed && cur < new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 7);
  body.innerHTML = `<div class="card" style="margin-bottom:10px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="month" id="sl-month" class="fi" value="${slEsc(cur)}" onchange="slMonth(document.getElementById('sl-body'), this.value)">${m.closed ? '<b style="color:var(--green,#2e7d32)">Closed. Never reopened; late returns become an adjustment next month.</b>' : (closable ? '<button class="btn btn-s" onclick="slClose()">Close this month</button>' : '')}</div></div>
    <div class="card" style="margin-bottom:10px">
      ${row('Gross profit', slRs(m.gross_profit))}${row('Sales returns', '- ' + slRs(m.returns))}${row('Expenses', '- ' + slRs(m.expenses))}${m.fixed_costs_added ? row('Rent and bills (not on the daily sheet)', '- ' + slRs(m.fixed_costs.rent_and_bills)) + row('Owner + colleague daily pay', '- ' + slRs(m.fixed_costs.daily_pay)) : ''}
      ${row('NET PROFIT', slRs(m.net), true)}${m.note ? `<div style="font-size:13px;color:var(--amber,#b26a00)">${slEsc(m.note)}</div>` : ''}
    </div>
    <div class="card" style="margin-bottom:10px">
      ${row('Shop savings (taken first, untouched)', slRs(m.split.save))}${row('Commission pool', slRs(m.split.pool))}
      ${row('Colleague commission', slRs(m.colleague_commission.calculated))}${row('Owner commission', slRs(m.owner_commission.calculated))}
      ${adj}
      ${row('Colleague is paid', slRs(m.colleague_commission.payable), true)}${row('Owner commission paid', slRs(m.owner_commission.payable), true)}
      ${m.colleague_commission.carried_forward || m.owner_commission.carried_forward ? `<div style="font-size:12px;color:var(--text2)">Carried to next month: colleague ${slRs(m.colleague_commission.carried_forward)}, owner ${slRs(m.owner_commission.carried_forward)}</div>` : ''}
      ${row('Stays with the owner', slRs(m.stays_with_owner), true)}
    </div>`;
}

async function slClose() {
  const ym = document.getElementById('sl-month').value;
  if (!confirm('Close ' + ym + '? It will never be reopened.')) return;
  const r = await fetch('/api/salary/month/' + ym + '/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) alert(d.error || 'Could not close');
  slMonth(document.getElementById('sl-body'), ym);
}

async function slSettings(body) {
  const { settings } = await slGet('/api/salary/settings');
  body.innerHTML = SL_FIELDS.map(([g, fields]) => `<div class="card" style="margin-bottom:10px"><div class="section-title" style="margin-bottom:8px">${slEsc(g)}</div>` +
    fields.map(([k, l]) => `<div class="fg"><label class="fl">${slEsc(l)}</label><input class="fi" type="number" step="any" id="sl-set-${k}" value="${slEsc(settings[k])}"></div>`).join('') + '</div>').join('') +
    `<button class="btn btn-p" onclick="slSave()">Save settings</button> <span id="sl-msg" style="font-size:13px"></span>`;
}

async function slSave() {
  const out = {};
  SL_FIELDS.forEach(([, fields]) => fields.forEach(([k]) => { out[k] = document.getElementById('sl-set-' + k).value; }));
  const r = await fetch('/api/salary/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
  const d = await r.json().catch(() => ({}));
  document.getElementById('sl-msg').textContent = r.ok ? 'Saved.' : (d.error || 'Could not save');
}


/* Dashboard card: today's cost target, savings to set aside, cheque reserve, who gets what. Owner only; hides itself for anyone else. */
async function loadSalaryCard() {
  const box = document.getElementById('salary-card');
  if (!box) return;
  try {
    const r = await fetch('/api/salary/overview');
    if (!r.ok) { box.innerHTML = ''; return; }
    const o = await r.json();
    const sv = o.savings_today, w = o.who_gets_what, c = o.cheque_reserve;
    const km = (o.setup_costs || []).map(x => `${slEsc(x.label)} (${slEsc(x.status)}): ${slRs(x.amount)}`).join(' &middot; ');
    box.innerHTML = `<div class="card" style="margin-bottom:18px"><div class="section-title" style="margin-bottom:8px">Today's money plan</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">
        <div><div style="font-size:12px;color:var(--text2)">Today's cost target</div><div style="font-size:20px;font-weight:800">${slRs(o.cost_target.target)}</div><div style="font-size:11px;color:var(--text2)">Hard ceiling ${slRs(o.cost_target.ceiling)}</div></div>
        <div><div style="font-size:12px;color:var(--text2)">Shop savings to set aside today</div><div style="font-size:20px;font-weight:800">${sv.pending ? 'PENDING' : slRs(sv.amount)}</div><div style="font-size:11px;color:var(--text2)">${sv.save_pct}% of net profit${sv.pending ? ' &middot; today\'s sales entry is not complete' : ''} &middot; change in Salary &amp; Costs &gt; Settings</div></div>
        <div><div style="font-size:12px;color:var(--text2)">Cheque reserve</div><div style="font-size:20px;font-weight:800">${slRs(c.set_aside_today)}</div><div style="font-size:11px;color:var(--text2)">set aside today &middot; ${c.count} cheque(s) due in ${c.due_within_days} days = ${slRs(c.due_total)}</div></div>
      </div>
      <div style="font-size:13px;margin-top:10px">Who gets what: ${w ? `savings <b>${slRs(w.savings)}</b> &middot; colleague commission <b>${slRs(w.colleague)}</b> &middot; owner <b>${slRs(w.owner)}</b> &middot; stays in shop <b>${slRs(w.stays)}</b>` : 'PENDING (needs today\'s profit and expenses)'}</div>
      ${km ? `<div style="font-size:12px;color:var(--text2);margin-top:6px">One-time: ${km}</div>` : ''}</div>`;
  } catch (e) { box.innerHTML = ''; }
}
window.addEventListener('load', () => setTimeout(loadSalaryCard, 1200));
