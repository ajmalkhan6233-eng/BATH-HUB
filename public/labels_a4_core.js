(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LabelsA4Core = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Standard Code 128 pattern table (same as public/labels.html, 107 entries, index = char code - 32; 106 = stop)
  var C128 = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

  function encode128(text) {
    var str = String(text || '');
    var parts = ['211214'], sum = 104, pos = 0;
    for (var i = 0; i < str.length; i++) {
      var v = str.charCodeAt(i) - 32;
      if (v < 0 || v > 94) continue;
      pos++;
      parts.push(C128[v]);
      sum += v * pos;
    }
    parts.push(C128[sum % 103]);
    parts.push(C128[106]);
    return parts.join('');
  }

  function barcodeSVG(text, h) {
    h = h || 20;
    var code = encode128(text);
    var width = 0;
    for (var i = 0; i < code.length; i++) width += parseInt(code[i], 10);
    var svg = ['<svg viewBox="0 0 ', width, ' ', h, '" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">'];
    var x = 0;
    for (var j = 0; j < code.length; j++) {
      var w = parseInt(code[j], 10);
      if (j % 2 === 0) {
        svg.push('<rect x="', x, '" y="0" width="', w, '" height="', h, '" fill="black"/>');
      }
      x += w;
    }
    svg.push('</svg>');
    return svg.join('');
  }

  function formatPrice(val) {
    if (val === null || val === undefined || val === '' || isNaN(val)) return '';
    var num = Number(val);
    if (num <= 0) return '';
    var parts = num.toFixed(2).split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (parts[1] === '00') {
      return 'Rs. ' + intPart;
    }
    return 'Rs. ' + intPart + '.' + parts[1];
  }

  function expandCopies(items) {
    var expanded = [];
    if (!items || !items.length) return expanded;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var qty = parseInt(item.copies, 10);
      if (isNaN(qty) || qty < 1) qty = 1;
      for (var c = 0; c < qty; c++) {
        expanded.push(item);
      }
    }
    return expanded;
  }

  function layoutSheets(labels, perSheet) {
    perSheet = perSheet || 40;
    var pages = [];
    if (!labels || !labels.length) return pages;
    for (var i = 0; i < labels.length; i += perSheet) {
      pages.push(labels.slice(i, i + perSheet));
    }
    return pages;
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    C128: C128,
    encode128: encode128,
    barcodeSVG: barcodeSVG,
    formatPrice: formatPrice,
    expandCopies: expandCopies,
    layoutSheets: layoutSheets,
    escapeHTML: escapeHTML
  };
}));
