import React, { useState } from 'react';
import { CreditCard, AlertTriangle, Phone, Search, DollarSign } from 'lucide-react';
import { sampleCustomers, branding } from '../mockData';
import { CustomerCredit } from '../types';

export default function CustomerCreditAging() {
  const [customers, setCustomers] = useState<CustomerCredit[]>(sampleCustomers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCredit | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<string>('');

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutstanding = customers.reduce((a, b) => a + b.currentBalance, 0);
  const totalOverdue = customers.reduce((a, b) => a + b.bucket90_plus + b.bucket61_90, 0);

  const handleSettlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(settlementAmount) || 0;
    if (amount <= 0) return;

    setCustomers(prev => prev.map(c => {
      if (c.id === selectedCustomer.id) {
        const newBal = Math.max(0, c.currentBalance - amount);
        return {
          ...c,
          currentBalance: newBal,
          bucket90_plus: Math.max(0, c.bucket90_plus - amount)
        };
      }
      return c;
    }));

    setSelectedCustomer(null);
    setSettlementAmount('');
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#d4af37]" />
            Customer Credit & Aging Analysis
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Accounts receivable aging matrix: Current (0–30d), 31–60d, 61–90d, and 90+ days overdue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-white/40" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-black/30 border border-white/15 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Total Credit Outstanding</div>
          <div className="text-2xl font-bold text-white mt-1">
            {branding.currency_symbol} {totalOutstanding.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Across {customers.length} customer accounts</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-red-500/20 rounded-xl p-4">
          <div className="text-xs text-red-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> High Risk (60+ Days)
          </div>
          <div className="text-2xl font-bold text-red-400 mt-1">
            {branding.currency_symbol} {totalOverdue.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Strict recovery follow-up recommended</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Average Credit Term</div>
          <div className="text-2xl font-bold text-[#d4af37] mt-1">28 Days</div>
          <div className="text-[11px] text-white/40 mt-1">Standard tile merchant trade policy</div>
        </div>
      </div>

      {/* Aging Table */}
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-white/40 bg-black/20">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium text-right">Credit Limit</th>
                <th className="px-5 py-3 font-medium text-right">Balance</th>
                <th className="px-5 py-3 font-medium text-right">0–30 Days</th>
                <th className="px-5 py-3 font-medium text-right">31–60 Days</th>
                <th className="px-5 py-3 font-medium text-right">61–90 Days</th>
                <th className="px-5 py-3 font-medium text-right text-red-400">90+ Days</th>
                <th className="px-5 py-3 font-medium text-center">Status</th>
                <th className="px-5 py-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cust => (
                <tr key={cust.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white/95">{cust.name}</div>
                    <div className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-[#d4af37]" /> {cust.phone}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-white/70">{cust.city}</td>
                  <td className="px-5 py-4 text-right text-white/50">
                    {branding.currency_symbol} {cust.creditLimit.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-white">
                    {branding.currency_symbol} {cust.currentBalance.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right text-emerald-400/90 font-mono">
                    {cust.bucket0_30 ? `${branding.currency_symbol} ${cust.bucket0_30.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-5 py-4 text-right text-amber-400/90 font-mono">
                    {cust.bucket31_60 ? `${branding.currency_symbol} ${cust.bucket31_60.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-5 py-4 text-right text-amber-500 font-mono">
                    {cust.bucket61_90 ? `${branding.currency_symbol} ${cust.bucket61_90.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-5 py-4 text-right text-red-400 font-bold font-mono">
                    {cust.bucket90_plus ? `${branding.currency_symbol} ${cust.bucket90_plus.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      cust.status === 'GOOD'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : cust.status === 'ATTENTION'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}>
                      {cust.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => setSelectedCustomer(cust)}
                      className="px-3 py-1 rounded bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#e8cf7a] text-xs font-semibold"
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle Payment Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#062e21] border border-[#d4af37]/40 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Record Settlement</h3>
            <p className="text-xs text-white/50 mb-4">
              Receiving payment from <strong className="text-white">{selectedCustomer.name}</strong>.
              Current debt: {branding.currency_symbol} {selectedCustomer.currentBalance.toLocaleString()}
            </p>

            <form onSubmit={handleSettlePayment} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-white/70 block mb-1">Payment Amount ({branding.currency_symbol})</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 50000"
                  value={settlementAmount}
                  onChange={e => setSettlementAmount(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#d4af37] text-[#062e21] hover:bg-[#ebd075]"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
