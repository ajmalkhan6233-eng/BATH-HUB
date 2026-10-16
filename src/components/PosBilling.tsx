import React, { useState } from 'react';
import { ShoppingCart, Search, Trash2, Printer, Check, Plus, Minus, AlertTriangle, Share2 } from 'lucide-react';
import { sampleProducts, branding } from '../mockData';
import { ProductItem } from '../types';

interface CartItem extends ProductItem {
  qty: number;
}

export default function PosBilling() {
  const [cart, setCart] = useState<CartItem[]>([
    { ...sampleProducts[0], qty: 50 },
    { ...sampleProducts[5], qty: 2 }
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CHEQUE' | 'TRANSFER'>('CASH');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2026-0891');

  const categories = ['All', 'Tiles', 'Sanitaryware', 'Taps & Mixers', 'Accessories'];

  const filteredProducts = sampleProducts.filter(p => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const addToCart = (product: ProductItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  // Max safe discount guard: 10% max for walk-in
  const discountAmount = (subtotal * Math.min(discountPct, 15)) / 100;
  const netTotal = subtotal - discountAmount;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setInvoiceNumber(`INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setShowReceipt(true);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#d4af37]" />
            POS Billing & Quick Counter
          </h2>
          <p className="text-xs text-white/50 mt-1">High-speed counter invoicing with barcode lookup and discount guard.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Cash Drawer: Online
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Catalog & Search */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Search & Category Filter */}
          <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-white/40" />
              <input
                type="text"
                placeholder="Scan barcode or search by item code, tile size..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#d4af37] text-[#062e21] font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-[#0a140e]/75 border border-white/10 hover:border-[#d4af37]/60 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 group"
              >
                <div>
                  <div className="text-[10px] text-white/40 font-mono tracking-wider">{product.code}</div>
                  <h4 className="text-xs font-semibold text-white/90 line-clamp-2 mt-1 group-hover:text-[#e8cf7a] transition-colors">
                    {product.name}
                  </h4>
                  <div className="text-[11px] text-white/50 mt-1">{product.category}</div>
                </div>

                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#d4af37]">
                    {branding.currency_symbol} {product.price.toLocaleString()}
                  </span>
                  <span className={`text-[10px] ${product.stock <= product.minStock ? 'text-amber-400 font-bold' : 'text-white/40'}`}>
                    {product.stock} {product.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Active Bill & Cart */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[#0a140e]/80 border border-[#d4af37]/30 rounded-2xl p-5 backdrop-blur-md shadow-xl flex flex-col min-h-[500px]">
            {/* Customer Inputs */}
            <div className="grid grid-cols-2 gap-3 mb-4 pb-3 border-b border-white/10">
              <div>
                <label className="text-[11px] text-white/50 block mb-1">Customer Name</label>
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/50 block mb-1">Phone Number (+94)</label>
                <input
                  placeholder="077xxxxxxx"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto max-h-[280px] flex flex-col gap-2 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-xs">
                  Cart is empty. Click or scan products on the left.
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl p-2.5 text-xs">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-medium text-white/90 truncate">{item.name}</div>
                      <div className="text-[10px] text-white/40">
                        {branding.currency_symbol} {item.price.toLocaleString()} × {item.qty}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="p-1 rounded bg-white/5 hover:bg-white/15 text-white/80"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-white min-w-[20px] text-center">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="p-1 rounded bg-white/5 hover:bg-white/15 text-white/80"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-red-400 hover:text-red-300 ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations & Discounts */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-white/60">
                <span>Subtotal:</span>
                <span>{branding.currency_symbol} {subtotal.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60 flex items-center gap-1">
                  Discount (%):
                  {discountPct > 10 && <span title="Max allowed discount is 15%"><AlertTriangle className="w-3 h-3 text-amber-400" /></span>}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={discountPct}
                    onChange={e => setDiscountPct(Math.min(15, Math.max(0, Number(e.target.value))))}
                    className="w-16 bg-black/40 border border-white/15 rounded px-2 py-1 text-right text-xs text-white"
                  />
                  <span className="text-amber-400 font-medium">-{branding.currency_symbol} {discountAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold text-white pt-2 border-t border-white/5">
                <span>Net Total:</span>
                <span className="text-lg text-[#d4af37]">
                  {branding.currency_symbol} {netTotal.toLocaleString()}
                </span>
              </div>

              {/* Tender payment methods */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {(['CASH', 'CARD', 'CHEQUE', 'TRANSFER'] as const).map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      paymentMethod === method
                        ? 'bg-[#d4af37] text-[#062e21] border-[#d4af37]'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {/* Complete Sale Action */}
              <button
                disabled={cart.length === 0}
                onClick={handleCheckout}
                className="mt-3 w-full bg-[#d4af37] hover:bg-[#ebd075] disabled:opacity-40 text-[#062e21] font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Complete Sale ({branding.currency_symbol} {netTotal.toLocaleString()})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col font-mono text-xs">
            <div className="text-center pb-4 border-b border-dashed border-slate-300">
              <h3 className="font-bold text-base tracking-tight font-sans text-slate-900">{branding.company_name}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{branding.address}</p>
              <p className="text-[11px] text-slate-500">Tel: {branding.phone}</p>
              <div className="mt-2 text-[10px] text-slate-400">
                {invoiceNumber} · {new Date().toLocaleDateString()}
              </div>
            </div>

            <div className="py-3 border-b border-dashed border-slate-300 flex flex-col gap-2">
              <div className="text-[11px]">Customer: {customerName}</div>
              <div className="text-[11px]">Payment: {paymentMethod}</div>
              <div className="border-t border-slate-100 my-1" />
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="truncate max-w-[180px]">{item.name} ×{item.qty}</span>
                  <span>{branding.currency_symbol} {(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="py-3 border-b border-dashed border-slate-300 flex flex-col gap-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{branding.currency_symbol} {subtotal.toLocaleString()}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Discount ({discountPct}%):</span>
                  <span>-{branding.currency_symbol} {discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                <span>Total Paid:</span>
                <span>{branding.currency_symbol} {netTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-3">
              Thank you for choosing Royal Bath Hub!
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-sans font-semibold text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-[#062e21] text-[#d4af37] py-2 rounded-lg font-sans font-semibold text-xs flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
