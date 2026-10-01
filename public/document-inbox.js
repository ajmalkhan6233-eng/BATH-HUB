const diEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Document Inbox: photos of papers, read, checked by Aj, then filed. Nothing is filed before Confirm. */
let _diStatus = 'to_check';
const DI_TYPES = [['salary_note','Salary list'],['manual_bill','Manual bill'],['grn','GRN (goods received)'],['cheque','Cheque'],['day_sheet','Daily sales sheet'],['expense_sheet','Expense list'],['invoice','Supplier invoice'],['customer_photo','Customer photo'],['unknown','Not recognised']];
const DI_FIELDS = {
  manual_bill: [['bill_number','Bill no.'],['date','Date (YYYY-MM-DD)'],['customer_name','Customer'],['customer_phone','Phone'],['discount','Discount (amount)'],['total','Total written on paper']],
  grn: [['grn_number','GRN no.'],['date','Date (YYYY-MM-DD)'],['supplier_name','Supplier'],['total','Total written on paper']],
  cheque: [['cheque_number','Cheque no.'],['bank','Bank'],['payee','Payee (who it is for)'],['amount','Amount'],['due_date','Cheque date (YYYY-MM-DD)'],['direction','Given or received']],
  day_sheet: [['date','Date (YYYY-MM-DD)'],['total_sale','Total sale'],['cash_sale','Cash'],['card_sale','Card'],['online_sale','Online'],['credit_sale','Credit'],['total_expenses','Total expenses'],['expense_items','Expense items'],['petty_cash','Petty cash'],['payouts','Payouts'],['cash_in','Cash in'],['cash_out','Cash out'],['cash_in_hand','Cash in hand'],['cash_banked','Cash banked']],
  expense_sheet: [['date','Date (YYYY-MM-DD)'],['total_expenses','Total expenses'],['expense_items','Expense items'],['total_sale','Total sale (if written)']],
};
const DI_ITEMS = { manual_bill: [['name','Item'],['qty','Qty'],['unit_price','Unit price'],['amount','Amount']], grn: [['item_code','Item code'],['description','Item'],['qty','Qty'],['unit_cost','Unit cost'],['amount','Amount']] };
function diMsg(t) { document.getElementById('di-msg').textContent = t || ''; }
async function diCall(url, method, body) {
  const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: d };
}
function diTabs() {
  document.getElementById('di-tabs').innerHTML = [['to_check','To check'],['filed','Filed'],['rejected','Rejected']].map(([k, l]) =>
    `<button class="btn ${k === _diStatus ? 'btn-p' : 'btn-s'}" onclick="_diStatus='${k}';loadDocInbox()">${l}</button>`).join('');
}
function diItemRow(type, it) {
  return `<tr>${DI_ITEMS[type].map(([k]) => `<td><input class="fi di-item-${k}" style="min-width:${k === 'name' || k === 'description' ? 120 : 60}px" value="${diEsc(it && it[k] != null ? it[k] : '')}"></td>`).join('')}<td><button class="btn btn-s" onclick="this.closest('tr').remove()">✕</button></td></tr>`;
}
function diForm(x) {
  const ex = x.extracted || {};
  if (!DI_FIELDS[x.doc_type]) return `<div style="font-size:13px;color:var(--text2)">${x.doc_type === 'invoice' ? 'Supplier invoices have no home yet. Change the type to GRN (goods received) to file it, or reject it.' : 'This cannot be filed as it is. Choose what it is above, or reject it.'}</div>`;
  const fields = DI_FIELDS[x.doc_type].map(([k, l]) => `<div class="fg"><label class="fl">${diEsc(l)}</label><input class="fi di-f-${k}" value="${diEsc(ex[k] != null ? ex[k] : '')}"></div>`).join('');
  let items = '';
  if (DI_ITEMS[x.doc_type]) {
    const rows = (ex.items || []).map(it => diItemRow(x.doc_type, it)).join('');
    items = `<div class="tbl-wrap"><table><thead><tr>${DI_ITEMS[x.doc_type].map(([, l]) => `<th>${diEsc(l)}</th>`).join('')}<th></th></tr></thead><tbody id="di-items-${x.id}">${rows}</tbody></table></div>
      <button class="btn btn-s" style="margin:6px 0" onclick="document.getElementById('di-items-${x.id}').insertAdjacentHTML('beforeend', diItemRow('${x.doc_type}'))">+ Add item</button>`;
  }
  const pay = x.doc_type === 'manual_bill' ? `<div class="fg"><label class="fl">Paid by</label><select class="fs di-f-payment_method">${['cash','card','online','cheque','credit'].map(m => `<option ${m === ex.payment_method ? 'selected' : ''}>${m}</option>`).join('')}</select></div>` : '';
  let match = '';
  if (x.doc_type === 'grn' && x.match) {
    const sup = x.match.supplier ? `<span style="color:var(--green,#2e7d32)">✓ Supplier: ${diEsc(x.match.supplier.name)}</span>` : `<span style="color:var(--amber)">Supplier not found in Suppliers</span>`;
    const lines = (x.match.items || []).map((m, n) => m.matched ? `<div style="font-size:12px;color:var(--green,#2e7d32)">✓ line ${n + 1}: ${diEsc(m.matched.item_code)} ${diEsc(m.matched.name)}</div>` : `<div style="font-size:12px;color:var(--amber)">line ${n + 1}: ${m.item_code ? 'code ' + diEsc(m.item_code) + ' not in the catalogue' : 'no item code'}</div>`).join('');
    match = `<div style="margin:6px 0">${sup}${lines}</div>`;
  }
  return `<div class="grid-3">${fields}${pay}</div>${items}${match}`;
}
function diCollect(id, type) {
  const card = document.getElementById('di-card-' + id), ex = {};
  (DI_FIELDS[type] || []).forEach(([k]) => { const el = card.querySelector('.di-f-' + k); if (el) ex[k] = el.value; });
  const pm = card.querySelector('.di-f-payment_method'); if (pm) ex.payment_method = pm.value;
  if (DI_ITEMS[type]) ex.items = [...card.querySelectorAll('#di-items-' + id + ' tr')].map(tr => { const it = {}; DI_ITEMS[type].forEach(([k]) => { it[k] = tr.querySelector('.di-item-' + k).value; }); return it; });
  return ex;
}
async function loadDocInbox() {
  diTabs();
  const r = await fetch('/api/document-inbox?status=' + _diStatus);
  if (!r.ok) { document.getElementById('di-list').innerHTML = '<div class="card no-data">Owner only</div>'; return; }
  const rows = await r.json();
  document.getElementById('di-list').innerHTML = rows.map(x => {
    const toCheck = x.status === 'to_check';
    const isPdf = /\.pdf$/i.test(x.file_path);
    const photo = isPdf ? `<a href="/api/document-inbox/${x.id}/photo" target="_blank" rel="noopener">Open the PDF</a>` : `<a href="/api/document-inbox/${x.id}/photo" target="_blank" rel="noopener"><img src="/api/document-inbox/${x.id}/photo" alt="paper" style="max-width:100%;max-height:340px;border-radius:6px;border:1px solid var(--border,#444)"></a>`;
    const typeSel = toCheck ? `<select class="fs" style="width:auto" onchange="diRetype(${x.id}, this.value)">${DI_TYPES.map(([k, l]) => `<option value="${k}" ${k === x.doc_type ? 'selected' : ''}>${diEsc(l)}</option>`).join('')}</select>` : `<b>${diEsc(x.type_label)}</b>`;
    const actions = toCheck ? `<button class="btn btn-p" ${x.fileable ? '' : 'disabled'} onclick="diFile(${x.id})">Confirm and file</button>
        <button class="btn btn-s" onclick="diSave(${x.id})">Save changes</button><button class="btn btn-s" onclick="diReread(${x.id})">Read again</button><button class="btn btn-s" onclick="diReject(${x.id})">Reject</button>`
      : (x.status === 'filed' ? `<span style="color:var(--green,#2e7d32)">Filed to <b>${diEsc(x.filed_to)}</b>: ${diEsc(x.filed_note || '')}</span>` : '<span style="color:var(--text2)">Rejected</span>');
    return `<div class="card" id="di-card-${x.id}" style="margin-bottom:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><b>#${x.id}</b> ${typeSel}
        <span style="font-size:12px;color:var(--text2)">${diEsc(x.source)}${x.from_ref ? ' · ' + diEsc(x.from_ref) : ''} · ${diEsc(String(x.created_at).slice(0, 16).replace('T', ' '))}${x.confidence ? ' · confidence ' + diEsc(x.confidence) : ''}</span></div>
      ${x.reader_note ? `<div style="font-size:12px;color:var(--amber);margin-bottom:6px">${diEsc(x.reader_note)}</div>` : ''}
      <div style="margin-bottom:8px">${photo}</div>
      ${toCheck ? diForm(x) : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">${actions}</div></div>`;
  }).join('') || '<div class="card no-data">Nothing here</div>';
}
async function diUpload() {
  const f = document.getElementById('di-file').files[0];
  if (!f) { diMsg('Choose or take a photo first'); return; }
  diMsg('Uploading and reading... this can take up to a minute.');
  const fd = new FormData(); fd.append('photo', f); fd.append('doc_type', document.getElementById('di-type').value);
  const r = await fetch('/api/document-inbox/upload', { method: 'POST', body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { diMsg(d.error || 'Upload failed'); return; }
  document.getElementById('di-file').value = ''; diMsg('Added as #' + d.id + '. Check it below.'); _diStatus = 'to_check'; loadDocInbox();
}
async function diSave(id, quiet) {
  const card = document.getElementById('di-card-' + id), type = card.querySelector('select').value;
  const r = await fetch('/api/document-inbox/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ doc_type: type, extracted: diCollect(id, type) }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { diMsg(d.error || 'Could not save'); return false; }
  if (!quiet) { diMsg('Saved.'); loadDocInbox(); }
  return true;
}
async function diRetype(id, type) {
  const r = await fetch('/api/document-inbox/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ doc_type: type }) });
  if (!r.ok) diMsg((await r.json().catch(() => ({}))).error || 'Could not change the type');
  loadDocInbox();
}
async function diFile(id) {
  if (!(await diSave(id, true))) return;
  let r = await fetch('/api/document-inbox/' + id + '/file', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
  let d = await r.json().catch(() => ({}));
  if (r.status === 409 && d.code === 'needs_confirmation') {
    if (!confirm(d.warnings.join('\n') + '\n\nFile it anyway?')) return;
    r = await fetch('/api/document-inbox/' + id + '/file', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ accept_warnings: true }) });
    d = await r.json().catch(() => ({}));
  }
  if (!r.ok) { diMsg(d.error || 'Could not file it'); return; }
  diMsg('Filed: ' + (d.filed_note || d.filed_to)); loadDocInbox();
}
async function diReread(id) { diMsg('Reading again...'); const r = await fetch('/api/document-inbox/' + id + '/reread', { method: 'POST' }); if (!r.ok) diMsg((await r.json().catch(() => ({}))).error || 'Could not read'); else diMsg(''); loadDocInbox(); }
async function diReject(id) { if (!confirm('Reject this paper? It will not be filed.')) return; await fetch('/api/document-inbox/' + id + '/reject', { method: 'POST' }); loadDocInbox(); }
