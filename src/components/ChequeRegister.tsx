import React, { useState } from 'react';
import { Calendar, Plus, CheckCircle, XCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { sampleCheques, branding } from '../mockData';
import { ChequeItem } from '../types';

export default function ChequeRegister() {
  const [cheques, setCheques] = useState<ChequeItem[]>(sampleCheques);
  const [activeTab, setActiveTab] = useState<'ALL' | 'INWARD' | 'OUTWARD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CLEARED' | 'RETURNED'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Cheque Form
  const [newCheque, setNewCheque] = useState<Partial<ChequeItem>>({
    bankName: 'Commercial Bank',
    type: 'INWARD',
    partyName: '',
    amount: 50000,
    chequeNumber: '',
    dueDate: '2026-06-15',
    status: 'PENDING',
    note: ''
  });

  const filteredCheques = cheques.filter(ch => {
    const matchType = activeTab === 'ALL' || ch.type === activeTab;
    const matchStatus = statusFilter === 'ALL' || ch.status === statusFilter;
    return matchType && matchStatus;
  });

  const pendingDue7Days = cheques.filter(c => c.status === 'PENDING');
  const totalPendingInward = cheques
    .filter(c => c.type === 'INWARD' && c.status === 'PENDING')
    .reduce((a, b) => a + b.amount, 0);
  const totalPendingOutward = cheques
    .filter(c => c.type === 'OUTWARD' && c.status === 'PENDING')
    .reduce((a, b) => a + b.amount, 0);

  const toggleStatus = (id: string, status: 'CLEARED' | 'RETURNED') => {
    setCheques(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const handleAddCheque = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheque.partyName || !newCheque.chequeNumber) return;

    const item: ChequeItem = {
      id: 'ch_' + Date.now(),
      chequeNumber: newCheque.chequeNumber,
      bankName: newCheque.bankName || 'Commercial Bank',
      type: newCheque.type || 'INWARD',
      partyName: newCheque.partyName,
      amount: Number(newCheque.amount) || 0,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: newCheque.dueDate || '2026-06-15',
      status: 'PENDING',
      note: newCheque.note
    };

    setCheques([item, ...cheques]);
    setShowAddModal(false);
    setNewCheque({
      bankName: 'Commercial Bank',
      type: 'INWARD',
      partyName: '',
      amount: 50000,
      chequeNumber: '',
      dueDate: '2026-06-15',
      status: 'PENDING',
      note: ''
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#d4af37]" />
            Post-Dated Cheques (PDC) Register
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Tracking customer receivables and supplier payables with Sri Lanka banking clearing rules.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#d4af37] text-[#062e21] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[#ebd075] transition-colors"
        >
          <Plus className="w-4 h-4" />
          + Record Cheque
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Pending Receivables (Inward)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {branding.currency_symbol} {totalPendingInward.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Incoming customer cheques to deposit</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Pending Payables (Outward)</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {branding.currency_symbol} {totalPendingOutward.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Issued to tile & fittings suppliers</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Next 7 Days Due</div>
          <div className="text-2xl font-bold text-[#d4af37] mt-1">
            {pendingDue7Days.length} Cheques
          </div>
          <div className="text-[11px] text-white/40 mt-1">Action required this banking week</div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
            {(['ALL', 'INWARD', 'OUTWARD'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab ? 'bg-[#d4af37] text-[#062e21]' : 'text-white/60 hover:text-white'
                }`}
              >
                {tab === 'ALL' ? 'All Cheques' : tab === 'INWARD' ? 'Customer Inward' : 'Supplier Outward'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-black/30 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending Only</option>
              <option value="CLEARED">Cleared</option>
              <option value="RETURNED">Returned</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-white/40 bg-black/20">
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Cheque No.</th>
                <th className="px-5 py-3 font-medium">Bank</th>
                <th className="px-5 py-3 font-medium">Customer / Payee</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
                <th className="px-5 py-3 font-medium">Due Date</th>
                <th className="px-5 py-3 font-medium text-center">Status</th>
                <th className="px-5 py-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCheques.map(cheque => (
                <tr key={cheque.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cheque.type === 'INWARD' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {cheque.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-white/90">{cheque.chequeNumber}</td>
                  <td className="px-5 py-3.5 text-white/70">{cheque.bankName}</td>
                  <td className="px-5 py-3.5 font-medium text-white/90">{cheque.partyName}</td>
                  <td className="px-5 py-3.5 font-bold text-right text-white">
                    {branding.currency_symbol} {cheque.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-white/70">{cheque.dueDate}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      cheque.status === 'CLEARED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : cheque.status === 'RETURNED'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}>
                      {cheque.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {cheque.status === 'PENDING' ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => toggleStatus(cheque.id, 'CLEARED')}
                          className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-semibold flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Clear
                        </button>
                        <button
                          onClick={() => toggleStatus(cheque.id, 'RETURNED')}
                          className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[10px] font-semibold flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Return
                        </button>
                      </div>
                    ) : (
                      <span className="text-white/30 text-[10px]">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cheque Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#062e21] border border-[#d4af37]/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Record Post-Dated Cheque</h3>
            <form onSubmit={handleAddCheque} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-white/60 block mb-1">Cheque Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCheque({ ...newCheque, type: 'INWARD' })}
                    className={`py-2 rounded-lg text-xs font-bold border ${newCheque.type === 'INWARD' ? 'bg-[#d4af37] text-[#062e21] border-[#d4af37]' : 'border-white/15 text-white/70'}`}
                  >
                    INWARD (Customer)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCheque({ ...newCheque, type: 'OUTWARD' })}
                    className={`py-2 rounded-lg text-xs font-bold border ${newCheque.type === 'OUTWARD' ? 'bg-[#d4af37] text-[#062e21] border-[#d4af37]' : 'border-white/15 text-white/70'}`}
                  >
                    OUTWARD (Supplier)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-white/60 block mb-1">Cheque Number</label>
                <input
                  required
                  placeholder="e.g. 641103"
                  value={newCheque.chequeNumber}
                  onChange={e => setNewCheque({ ...newCheque, chequeNumber: e.target.value })}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-white/60 block mb-1">Bank Name</label>
                <input
                  required
                  placeholder="e.g. Commercial Bank / NDB"
                  value={newCheque.bankName}
                  onChange={e => setNewCheque({ ...newCheque, bankName: e.target.value })}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-white/60 block mb-1">Party / Payee Name</label>
                <input
                  required
                  placeholder="e.g. Al-Huda Constructions"
                  value={newCheque.partyName}
                  onChange={e => setNewCheque({ ...newCheque, partyName: e.target.value })}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">Amount ({branding.currency_symbol})</label>
                  <input
                    type="number"
                    required
                    value={newCheque.amount}
                    onChange={e => setNewCheque({ ...newCheque, amount: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newCheque.dueDate}
                    onChange={e => setNewCheque({ ...newCheque, dueDate: e.target.value })}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#d4af37] text-[#062e21] hover:bg-[#ebd075]"
                >
                  Save Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
