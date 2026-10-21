// COST CODE (Aj, 2026-10-21): the buying price written in letters, for the shop's own price labels.
// MONEYTALKS: M=1 O=2 N=3 E=4 Y=5 T=6 A=7 L=8 K=9 S=0.   1,600 -> MTSS   2,450 -> OEYS
// PRIVATE: used ONLY by the owner's label page (labels.html). Never include this file in a customer-facing page.
(function (root) {
    var KEY = 'MONEYTALKS';   // digit i (1,2,...,9,0) -> KEY[i-1], with 0 -> last letter
    function costCode(n) {
        n = Number(n);
        if (!isFinite(n) || n <= 0) return '';
        return String(Math.round(n)).split('').map(function (d) { return KEY[(Number(d) + 9) % 10]; }).join('');
    }
    function decode(code) {
        var s = String(code || '').toUpperCase(), out = '';
        for (var i = 0; i < s.length; i++) { var k = KEY.indexOf(s[i]); if (k < 0) return ''; out += (k + 1) % 10; }
        return out;
    }
    var api = { costCode: costCode, decode: decode };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CostCode = api;
})(typeof self !== 'undefined' ? self : this);
