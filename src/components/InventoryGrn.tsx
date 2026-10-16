import React, { useState } from 'react';
import { Package, Plus, AlertCircle, ArrowUpRight, Check, Search } from 'lucide-react';
import { sampleProducts, branding } from '../mockData';
import { ProductItem } from '../types';

export default function InventoryGrn() {
  const [products, setProducts] = useState<ProductItem[]>(sampleProducts);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGrnModal, setShowGrnModal] = useState(false);

  // GRN Form
  const [supplierName, setSupplierName] = useState('Eskema Ceramic');
  const [invoiceRef, setInvoiceRef] = useState('INV-SUP-9081');
  const [selectedProductId, setSelectedProductId] = useState(sampleProducts[0].id);
  const [receivedQty, setReceivedQty] = useState(100);
  const [unitCost, setUnitCost] = useState(320);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStockValue = products.reduce((acc, p) => acc + p.cost * p.stock, 0);
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  const handleSaveGrn = (e: React.FormEvent) => {
    e.preventDefault();
    setProducts(prev => prev.map(p => {
      if (p.id === selectedProductId) {
        return {
          ...p,
          stock: p.stock + Number(receivedQty),
          cost: Number(unitCost)
        };
      }
      return p;
    }));
    setShowGrnModal(false);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-[#d4af37]" />
            Inventory & Goods Received Note (GRN)
          </h2>
          <p className="text-xs text-white/50 mt-1">Real-time stock valuation, margin tracking, and supplier GRN entry.</p>
        </div>

        <button
          onClick={() => setShowGrnModal(true)}
          className="bg-[#d4af37] text-[#062e21] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[#ebd075] transition-colors"
        >
          <Plus className="w-4 h-4" />
          + New GRN Inward
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Total Warehouse Value (At Cost)</div>
          <div className="text-2xl font-bold text-[#d4af37] mt-1">
            {branding.currency_symbol} {totalStockValue.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Across {products.length} catalog lines</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-amber-500/20 rounded-xl p-4">
          <div className="text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Reorder Trigger Warnings
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {lowStockCount} Products
          </div>
          <div className="text-[11px] text-white/40 mt-1">Stock at or below minimum reserve limit</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Average Gross Margin</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">36.4%</div>
          <div className="text-[11px] text-white/40 mt-1">Retail margin above landed unit cost</div>
        </div>
      </div>

      {/* Product List */}
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-white/40" />
            <input
              type="text"
              placeholder="Search SKU or item name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/30 border border-white/15 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-white/40 bg-black/20">
                <th className="px-5 py-3 font-medium">Item Code</th>
                <th className="px-5 py-3 font-medium">Product Name</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium text-right">Cost Price</th>
                <th className="px-5 py-3 font-medium text-right">Selling Price</th>
                <th className="px-5 py-3 font-medium text-right">Markup %</th>
                <th className="px-5 py-3 font-medium text-right">Available Stock</th>
                <th className="px-5 py-3 font-medium text-center">Website</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const markup = Math.round(((p.price - p.cost) / p.cost) * 100);
                const isLow = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[#d4af37]">{p.code}</td>
                    <td className="px-5 py-3.5 font-medium text-white/95">{p.name}</td>
                    <td className="px-5 py-3.5 text-white/60">{p.category}</td>
                    <td className="px-5 py-3.5 text-right text-white/60">
                      {branding.currency_symbol} {p.cost.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-white">
                      {branding.currency_symbol} {p.price.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right text-emerald-400 font-semibold">
                      +{markup}%
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                        isLow ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white'
                      }`}>
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Live
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRN Modal */}
      {showGrnModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#062e21] border border-[#d4af37]/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Record Goods Received Note (GRN)</h3>
            <p className="text-xs text-white/50 mb-4">Ingest supplier consignment and update warehouse balance.</p>

            <form onSubmit={handleSaveGrn} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-white/70 block mb-1">Supplier</label>
                <input
                  required
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-white/70 block mb-1">Invoice / Delivery Ref</label>
                <input
                  required
                  value={invoiceRef}
                  onChange={e => setInvoiceRef(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-white/70 block mb-1">Product</label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/70 block mb-1">Received Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={receivedQty}
                    onChange={e => setReceivedQty(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/70 block mb-1">Landed Cost ({branding.currency_symbol})</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={unitCost}
                    onChange={e => setUnitCost(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#d4af37] text-[#062e21] hover:bg-[#ebd075]"
                >
                  Post GRN to Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
