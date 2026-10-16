import React, { useState } from 'react';
import { FileText, Plus, Trash2, Printer, Share2, Check } from 'lucide-react';
import { sampleProducts, branding } from '../mockData';
import { Quotation, QuotationItem } from '../types';

export default function Quotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([
    {
      id: 'q1',
      quoteNumber: 'QT-2026-104',
      customerName: 'Al-Huda Constructions',
      phone: '0771234567',
      date: '2026-06-08',
      validUntil: '2026-06-22',
      items: [
        { productId: 'p1', productName: 'Royal Beige Spanish Porcelain Tile', qty: 250, unitPrice: 490, total: 122500 },
        { productId: 'p5', productName: 'Royal Square Rimless Commode Soft-Close', qty: 2, unitPrice: 52900, total: 105800 }
      ],
      subtotal: 228300,
      discount: 11415,
      tax: 0,
      total: 216885,
      status: 'SENT'
    }
  ]);

  const [showNewModal, setShowNewModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([
    { productId: sampleProducts[0].id, productName: sampleProducts[0].name, qty: 100, unitPrice: sampleProducts[0].price, total: sampleProducts[0].price * 100 }
  ]);
  const [discountPercent, setDiscountPercent] = useState(5);

  const addItemRow = () => {
    const p = sampleProducts[0];
    setItems([...items, { productId: p.id, productName: p.name, qty: 10, unitPrice: p.price, total: p.price * 10 }]);
  };

  const updateItemRow = (index: number, pId: string, qty: number) => {
    const product = sampleProducts.find(p => p.id === pId) || sampleProducts[0];
    setItems(items.map((it, idx) => {
      if (idx === index) {
        return {
          productId: product.id,
          productName: product.name,
          qty,
          unitPrice: product.price,
          total: product.price * qty
        };
      }
      return it;
    }));
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const subtotal = items.reduce((acc, it) => acc + it.total, 0);
  const discountAmt = (subtotal * discountPercent) / 100;
  const netTotal = subtotal - discountAmt;

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName) return;

    const newQuote: Quotation = {
      id: 'q_' + Date.now(),
      quoteNumber: `QT-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerName,
      phone,
      date: new Date().toISOString().split('T')[0],
      validUntil: '2026-06-30',
      items,
      subtotal,
      discount: discountAmt,
      tax: 0,
      total: netTotal,
      status: 'SENT'
    };

    setQuotations([newQuote, ...quotations]);
    setShowNewModal(false);
    setCustomerName('');
    setPhone('');
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#d4af37]" />
            Quotations & Project Estimates
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Official commercial proposals for builders, architects, and retail clients.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="bg-[#d4af37] text-[#062e21] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[#ebd075] transition-colors"
        >
          <Plus className="w-4 h-4" />
          + Create Quotation
        </button>
      </div>

      {/* Quotations List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quotations.map(q => (
          <div key={q.id} className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#d4af37]">{q.quoteNumber}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {q.status}
                </span>
              </div>

              <h3 className="text-base font-bold text-white mt-2">{q.customerName}</h3>
              <p className="text-xs text-white/50">{q.phone} · Valid until {q.validUntil}</p>

              <div className="mt-4 border-t border-white/5 pt-3 flex flex-col gap-1.5">
                {q.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-white/70">
                    <span className="truncate max-w-[200px]">{it.productName} × {it.qty}</span>
                    <span className="font-mono text-white/90">{branding.currency_symbol} {it.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-white/40 block">Estimated Net Value</span>
                <span className="text-base font-bold text-[#e8cf7a]">
                  {branding.currency_symbol} {q.total.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
                  title="Print"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const text = encodeURIComponent(`Quotation ${q.quoteNumber} from Royal Bath Hub for ${branding.currency_symbol} ${q.total.toLocaleString()}`);
                    window.open(`https://wa.me/94777999219?text=${text}`, '_blank');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Quote Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#062e21] border border-[#d4af37]/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Draft Commercial Quotation</h3>
            <form onSubmit={handleCreateQuote} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">Customer / Company</label>
                  <input
                    required
                    placeholder="e.g. Al-Huda Constructions"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">Phone (+94)</label>
                  <input
                    placeholder="077xxxxxxx"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="border border-white/10 rounded-xl p-3 bg-black/20 flex flex-col gap-2.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-[#e8cf7a]">Quotation Items</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-[11px] text-[#d4af37] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={item.productId}
                      onChange={e => updateItemRow(index, e.target.value, item.qty)}
                      className="flex-1 bg-black/40 border border-white/15 rounded px-2 py-1.5 text-xs text-white"
                    >
                      {sampleProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({branding.currency_symbol} {p.price})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={e => updateItemRow(index, item.productId, Number(e.target.value))}
                      className="w-16 bg-black/40 border border-white/15 rounded px-2 py-1.5 text-xs text-white text-center"
                    />
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs text-white/60">
                <span>Discount (%):</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Number(e.target.value))}
                  className="w-16 bg-black/40 border border-white/15 rounded px-2 py-1 text-right text-xs text-white"
                />
              </div>

              <div className="flex justify-between items-center text-sm font-bold text-white pt-2 border-t border-white/10">
                <span>Total Quotation:</span>
                <span className="text-base text-[#d4af37]">
                  {branding.currency_symbol} {netTotal.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-end gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white/60 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#d4af37] text-[#062e21] hover:bg-[#ebd075]"
                >
                  Generate Estimate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
