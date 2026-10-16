import React, { useState } from 'react';
import { DollarSign, Plus, CheckCircle, AlertOctagon, FileCheck, Layers } from 'lucide-react';
import { currentDay, branding } from '../mockData';
import { ExpenseRecord } from '../types';

export default function DailyCashReconciliation() {
  const [openingCash, setOpeningCash] = useState(25000); // 25,000 float
  const [cashSales, setCashSales] = useState(65800);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([
    { id: 'e1', date: '2026-06-09', category: 'Transport', description: 'Tile transport delivery lorry diesel', amount: 8500, paidBy: 'Cash Till' },
    { id: 'e2', date: '2026-06-09', category: 'Staff Lunch', description: 'Showroom staff lunch & tea', amount: 4200, paidBy: 'Cash Till' },
    { id: 'e3', date: '2026-06-09', category: 'Packaging', description: 'Tile bubble wrap & strapping tape', amount: 2400, paidBy: 'Cash Till' }
  ]);

  const [actualPhysicalCash, setActualPhysicalCash] = useState(75700);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: 'Petty Cash', description: '', amount: 1000 });
  const [closedStatus, setClosedStatus] = useState<string | null>(null);

  const totalPettyExpenses = expenses.reduce((a, b) => a + b.amount, 0);
  // Cash Proof: Opening Cash + Cash Inflows - Cash Outflows
  const expectedCashInHand = openingCash + cashSales - totalPettyExpenses;
  const discrepancy = actualPhysicalCash - expectedCashInHand;
  const isBalanced = Math.abs(discrepancy) < 1;

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) return;
    const item: ExpenseRecord = {
      id: 'e_' + Date.now(),
      date: '2026-06-09',
      category: newExpense.category as any,
      description: newExpense.description,
      amount: Number(newExpense.amount),
      paidBy: 'Cash Till'
    };
    setExpenses([...expenses, item]);
    setShowAddExpense(false);
    setNewExpense({ category: 'Petty Cash', description: '', amount: 1000 });
  };

  const handleCloseDay = () => {
    if (isBalanced) {
      setClosedStatus('Day closed successfully! Reconciled and logged to golden audit ledger.');
    } else {
      setClosedStatus(`Day closed with a difference of ${branding.currency_symbol} ${discrepancy.toLocaleString()}. Flagged for review.`);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#d4af37]" />
            End-of-Day (EOD) Cash Proof & Reconciliation
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Golden-Core Cash Proof: Opening Cash Float + Cash Sales - Petty Expenses = Expected Till Balance.
          </p>
        </div>

        <button
          onClick={() => setShowAddExpense(true)}
          className="bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          + Record Petty Expense
        </button>
      </div>

      {closedStatus && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
          isBalanced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {isBalanced ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertOctagon className="w-4 h-4 text-amber-400" />}
          <span>{closedStatus}</span>
        </div>
      )}

      {/* Cash Proof Formula Waterfall */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Opening Float</div>
          <div className="text-xl font-bold text-white mt-1">
            {branding.currency_symbol} {openingCash.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/40 mt-1">Standard morning float</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-emerald-500/20 rounded-xl p-4">
          <div className="text-xs text-emerald-400 uppercase tracking-wider">+ Cash Inflows</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            +{branding.currency_symbol} {cashSales.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/40 mt-1">Today's direct counter cash sales</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-red-500/20 rounded-xl p-4">
          <div className="text-xs text-red-400 uppercase tracking-wider">- Petty Cash Expenses</div>
          <div className="text-xl font-bold text-red-400 mt-1">
            -{branding.currency_symbol} {totalPettyExpenses.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/40 mt-1">{expenses.length} verified voucher entries</div>
        </div>

        <div className={`bg-[#0a140e]/75 border rounded-xl p-4 ${isBalanced ? 'border-[#d4af37]/40' : 'border-amber-500/40'}`}>
          <div className="text-xs text-[#e8cf7a] uppercase tracking-wider">= Expected Till Balance</div>
          <div className="text-xl font-bold text-[#d4af37] mt-1">
            {branding.currency_symbol} {expectedCashInHand.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/40 mt-1">Calculated mathematical proof</div>
        </div>
      </div>

      {/* Till Physical Verification Card */}
      <div className="bg-[#0a140e]/75 border border-[#d4af37]/30 rounded-2xl p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-base font-bold text-white">Physical Till Count Verification</h3>
          <p className="text-xs text-white/50 mt-1">
            Enter the exact physical notes and coins counted in the cash register drawer tonight.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <label className="text-[11px] text-white/50 block mb-1">Physical Cash Count ({branding.currency_symbol})</label>
            <input
              type="number"
              value={actualPhysicalCash}
              onChange={e => setActualPhysicalCash(Number(e.target.value))}
              className="bg-black/40 border border-white/20 rounded-xl px-4 py-2 text-base font-bold text-white focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[11px] text-white/50 mb-1">Audit Difference</span>
            <div className={`text-base font-bold px-3 py-1.5 rounded-lg border ${
              isBalanced ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {discrepancy >= 0 ? `+${discrepancy}` : discrepancy} {branding.currency_symbol}
            </div>
          </div>

          <button
            onClick={handleCloseDay}
            className="bg-[#d4af37] text-[#062e21] px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-[#ebd075] transition-all self-end"
          >
            Finalize EOD Close
          </button>
        </div>
      </div>

      {/* Expense Vouchers Table */}
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#e8cf7a] uppercase tracking-wider">Today's Petty Cash Vouchers</h3>
          <span className="text-xs text-white/50 font-mono">
            Total Outflow: {branding.currency_symbol} {totalPettyExpenses.toLocaleString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-white/40 bg-black/20">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Paid By</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-white/60">{e.date}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/80 border border-white/10">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-white/90">{e.description}</td>
                  <td className="px-5 py-3 text-white/50">{e.paidBy}</td>
                  <td className="px-5 py-3 font-mono font-bold text-right text-red-400">
                    -{branding.currency_symbol} {e.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Expense */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#062e21] border border-[#d4af37]/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Record Petty Cash Expense</h3>
            <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-white/70 block mb-1">Expense Category</label>
                <select
                  value={newExpense.category}
                  onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="Transport">Transport / Delivery Diesel</option>
                  <option value="Staff Lunch">Staff Lunch & Refreshments</option>
                  <option value="Utility">Utility & Shop Maintenance</option>
                  <option value="Packaging">Packaging Material</option>
                  <option value="Petty Cash">General Petty Cash</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-white/70 block mb-1">Description</label>
                <input
                  required
                  placeholder="e.g. Lorry diesel to Kandy Road site"
                  value={newExpense.description}
                  onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-white/70 block mb-1">Amount ({branding.currency_symbol})</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newExpense.amount}
                  onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#d4af37] text-[#062e21] hover:bg-[#ebd075]"
                >
                  Add Expense Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
