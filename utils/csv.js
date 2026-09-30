// utils/csv.js
// CSV cells for spreadsheets. Free-text cells that start with = + - @ (or a tab/CR) are read as
// formulas by Excel/Sheets; they get a leading ' so they show as plain text instead.
function csvCell(v, isText) {
    let t = String(v == null ? '' : v);
    if (isText && /^[=+\-@\x09\x0d]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
}

function csvRow(cells) {
    // cells: [[value, isText], ...] or plain values (treated as numbers/safe)
    return cells.map(c => Array.isArray(c) ? csvCell(c[0], c[1]) : csvCell(c, false)).join(',');
}

module.exports = { csvCell, csvRow };
