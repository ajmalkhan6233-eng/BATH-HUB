import React, { useState } from 'react';
import { Users, Award, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';
import { initialStaffList, branding } from '../mockData';
import { StaffMember } from '../types';

export default function StaffCommissions() {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaffList);

  const totalSales = staff.reduce((a, b) => a + (b.salesMonth || 0), 0);
  const totalCommission = staff.reduce((a, b) => a + (b.commissionEarned || 0), 0);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-[#d4af37]" />
            Staff Performance & Commissions
          </h2>
          <p className="text-xs text-white/50 mt-1">
            2.0% store commission on gross profit plus milestone tier incentives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#d4af37]/20 text-[#e8cf7a] border border-[#d4af37]/30">
            Active Cycle: June 2026
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Total Showroom Sales MTD</div>
          <div className="text-2xl font-bold text-white mt-1">
            {branding.currency_symbol} {totalSales.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Target for month: {branding.currency_symbol} 4,000,000</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-emerald-500/20 rounded-xl p-4">
          <div className="text-xs text-emerald-400 uppercase tracking-wider">Total Commission Accrued</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {branding.currency_symbol} {totalCommission.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Payable on monthly close</div>
        </div>

        <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Top Consultant This Month</div>
          <div className="text-2xl font-bold text-[#d4af37] mt-1">
            {staff[1]?.name || 'Fahim Mohamed'}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Leading with {branding.currency_symbol} 820,000 in sales</div>
        </div>
      </div>

      {/* Staff Leaderboard */}
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-bold text-[#e8cf7a] uppercase tracking-wider">Consultant Leaderboard</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-white/40 bg-black/20">
                <th className="px-5 py-3 font-medium">Rank</th>
                <th className="px-5 py-3 font-medium">Sales Consultant</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium text-right">Month Sales</th>
                <th className="px-5 py-3 font-medium text-right">Target Progress</th>
                <th className="px-5 py-3 font-medium text-right">Commission (2%)</th>
                <th className="px-5 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member, index) => {
                const target = 1000000;
                const pct = Math.min(100, Math.round(((member.salesMonth || 0) / target) * 100));
                return (
                  <tr key={member.username} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 font-bold text-[#d4af37]">#{index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white/95">{member.name}</div>
                      <div className="text-[11px] text-white/40">@{member.username}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-white/5 text-white/60 border border-white/10">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-white">
                      {branding.currency_symbol} {(member.salesMonth || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-black/40 h-2 rounded-full overflow-hidden border border-white/10">
                          <div className="bg-[#d4af37] h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-white/70 min-w-[32px]">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-400">
                      {branding.currency_symbol} {(member.commissionEarned || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
