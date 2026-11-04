import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, RefreshCw, ChevronLeft, ChevronRight, FileText, Settings, CircleDot, ChevronDown } from 'lucide-react';
import { branding, featureFlags, day, last7 } from '../mockData';
import SettingsPage from './SettingsPage';
import { PackagesTiersPage, ClientActivationsPage } from './PlatformAdmin';

type NavItem = {
  label: string;
  flag?: keyof typeof featureFlags;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: 'Platform Admin',
    items: [
      { label: 'Packages & Tiers' },
      { label: 'Client Activations' }
    ]
  },
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard Home' },
      { label: 'Daily / Weekly / Monthly' },
      { label: 'Reports & Analytics' }
    ]
  },
  {
    title: 'Operations',
    items: [
      { label: 'Customers' },
      { label: 'Credit & Aging' },
      { label: 'Suppliers' },
      { label: 'Staff' },
      { label: 'Cheques' },
      { label: 'Inventory & GRN' },
      { label: 'Quotations' },
      { label: 'Purchasing' },
      { label: 'Staff Extended' },
      { label: 'POS Billing', flag: 'pos_billing' },
      { label: 'Barcode Labels', flag: 'inv_barcode_labels' },
      { label: 'Commission', flag: 'staff_commission_display' }
    ]
  },
  {
    title: 'Finance',
    items: [
      { label: 'Audit & Accounting' },
      { label: 'Accounting' },
      { label: 'AI Assistant', flag: 'ai_assistant_chat' },
      { label: 'System Tools' }
    ]
  }
];

export default function DashboardApp() {
  const [currentPage, setCurrentPage] = useState('Dashboard Home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const navigateTo = (page: string) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen text-white/90 font-sans relative overflow-x-hidden">
      {/* Theme Layer Background */}
      <div id="theme-layer" className="fixed inset-0 -z-10 bg-gradient-to-br from-[#062e21] to-[#0a4531]" />

      {/* Top Shell Nav */}
      <nav className="sticky top-0 z-50 bg-[#0a140e]/72 backdrop-blur-md border-b border-white/10 px-4 h-16 flex items-center justify-between">
        {/* Left: Brand Block */}
        <div className="flex flex-col">
          <span className="font-semibold text-[15px] tracking-tight">{branding.company_name}</span>
          <span className="text-[10px] text-white/50 uppercase tracking-widest">Nature — real-data ERP</span>
        </div>

        {/* Center/Right: Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navGroups.map(group => (
            <DropdownNav key={group.title} group={group} currentPage={currentPage} onNavigate={navigateTo} />
          ))}
          
          <div className="w-px h-6 bg-white/10 mx-2" />
          
          <button 
            onClick={() => navigateTo('Settings')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              currentPage === 'Settings' ? 'bg-white/10 text-[#d4af37]' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>

        {/* Far Right: Icon Buttons (Desktop & Mobile) */}
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors lg:flex hidden">
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            className="lg:hidden p-2 rounded-lg text-white/70 hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Nav Sheet */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-[#062e21]/95 backdrop-blur-xl border-t border-white/5 overflow-y-auto lg:hidden">
          <div className="p-4 flex flex-col gap-6 pb-20">
            {navGroups.map(group => (
              <div key={group.title} className="flex flex-col gap-2">
                <div className="text-[11px] font-bold text-[#e8cf7a] uppercase tracking-wider mb-1">{group.title}</div>
                {group.items.map(item => {
                  const isOff = item.flag && !featureFlags[item.flag];
                  return (
                    <button
                      key={item.label}
                      onClick={() => navigateTo(item.label)}
                      className={`text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                        currentPage === item.label ? 'bg-white/10 text-[#d4af37]' : 'text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isOff && <OffBadge />}
                    </button>
                  );
                })}
              </div>
            ))}
            
            <div className="w-full h-px bg-white/10 my-2" />
            
            <button
              onClick={() => navigateTo('Settings')}
              className={`text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                currentPage === 'Settings' ? 'bg-white/10 text-[#d4af37]' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white tracking-tight">{currentPage}</h1>
          <div className="text-sm text-white/50 mt-1">
            {currentPage === 'Dashboard Home' ? 'Overview of current operations and daily totals.' : 'Module loaded and active.'}
          </div>
        </div>

        {currentPage === 'Dashboard Home' ? (
          <HomeContent onReportClick={() => showToast('Report exported (demo)')} />
        ) : currentPage === 'Settings' ? (
          <SettingsPage />
        ) : currentPage === 'Packages & Tiers' ? (
          <PackagesTiersPage />
        ) : currentPage === 'Client Activations' ? (
          <ClientActivationsPage />
        ) : (
          <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] p-12 flex items-center justify-center min-h-[400px]">
            <div className="text-white/40 font-medium">Coming from integration: {currentPage}</div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#0a140e]/90 border border-[#d4af37]/30 text-white px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 flex items-center gap-3 z-50">
          <div className="w-2 h-2 rounded-full bg-[#d4af37]" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

// --- Navigation Sub-components ---

const DropdownNav: React.FC<{ group: NavGroup, currentPage: string, onNavigate: (p: string) => void }> = ({ group, currentPage, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  const isActive = group.items.some(i => i.label === currentPage);

  return (
    <div 
      className="relative" 
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
    >
      <button 
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive || isOpen ? 'text-white bg-white/5' : 'text-white/70 hover:bg-white/5 hover:text-white'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{group.title}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''} opacity-50`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[#0a140e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 z-50">
          {group.items.map(item => {
            const isOff = item.flag && !featureFlags[item.flag];
            return (
              <button
                key={item.label}
                onClick={() => {
                  onNavigate(item.label);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between transition-colors ${
                  currentPage === item.label ? 'bg-white/10 text-[#d4af37]' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {isOff && <OffBadge />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OffBadge() {
  return (
    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 text-[9px] font-bold tracking-wider uppercase border border-amber-500/20">
      Off
    </span>
  );
}

// --- HOME PAGE Content ---

function HomeContent({ onReportClick }: { onReportClick: () => void }) {
  const formatMoney = (val: number) => `${branding.currency_symbol} ${val.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      
      {/* 1. Control Cluster */}
      <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] p-2 flex flex-wrap items-center justify-between gap-4 backdrop-blur-sm shadow-lg">
        <div className="flex items-center gap-1">
          <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="relative group">
            <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm font-medium flex items-center gap-2 group-hover:bg-white/10 transition-colors">
              Mon 09 Jun 2026
            </div>
            {/* Hidden native input for overlay/accessible clicking, strictly optional as per spec */}
            <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>

          <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />
          
          <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors hidden sm:block" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-2 text-[#d4af37]/70 hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-colors hidden sm:flex items-center gap-1" title="Jump to latest closed day">
            <CircleDot className="w-4 h-4" />
          </button>
        </div>

        <button 
          onClick={onReportClick}
          className="ml-auto sm:ml-0 bg-[#d4af37] text-[#062e21] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#ebd075] transition-colors focus:ring-2 focus:ring-[#d4af37]/50"
        >
          <FileText className="w-4 h-4" />
          DAY REPORT
        </button>
      </div>

      {/* 2. KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Sale */}
        <KpiCard 
          title="Total Sale"
          value={formatMoney(day.total_sale)}
          subText={`${day.invoices} invoices`}
          accent="gold"
        />
        
        {/* Expenses */}
        <KpiCard 
          title="Expenses"
          value={formatMoney(day.expenses)}
          subText={`${day.expense_entries} entries`}
          accent="amber"
        />

        {/* Net Profit */}
        <KpiCard 
          title="Net Profit"
          value={formatMoney(day.net_profit)}
          subText="after all expenses"
          accent={day.net_profit >= 0 ? 'green' : 'red'}
        />

        {/* Cash In Hand */}
        <KpiCard 
          title="Cash In Hand"
          value={formatMoney(day.cash_in_hand)}
          subText={`expected ${formatMoney(day.cash_expected)}`}
          accent={day.cash_in_hand >= day.cash_expected ? 'green' : 'red'}
        />
      </div>

      {/* 3. Last 7 Days Table */}
      <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] backdrop-blur-sm overflow-hidden flex flex-col shadow-lg">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-[14px] font-bold text-[#e8cf7a] tracking-widest uppercase">Last 7 Days</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium text-right">Sale</th>
                <th className="px-5 py-3 font-medium text-right">Expenses</th>
                <th className="px-5 py-3 font-medium text-right">Net Profit</th>
                <th className="px-5 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {last7.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors last:border-0">
                  <td className="px-5 py-3 font-medium text-white/90">{row.date}</td>
                  <td className="px-5 py-3 text-right text-white/80">{formatMoney(row.sale)}</td>
                  <td className="px-5 py-3 text-right text-white/80">{formatMoney(row.expenses)}</td>
                  <td className={`px-5 py-3 text-right font-medium ${row.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(row.net_profit)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function KpiCard({ title, value, subText, accent }: { title: string, value: string, subText: string, accent: 'gold' | 'amber' | 'green' | 'red' }) {
  const styles = {
    gold: {
      dot: 'bg-[#d4af37]',
      bg: 'bg-gradient-to-br from-[#d4af37]/10 to-transparent',
      border: 'border-[#d4af37]/20',
      value: 'text-white'
    },
    amber: {
      dot: 'bg-amber-400',
      bg: 'bg-gradient-to-br from-amber-400/10 to-transparent',
      border: 'border-amber-400/20',
      value: 'text-white'
    },
    green: {
      dot: 'bg-emerald-400',
      bg: 'bg-gradient-to-br from-emerald-400/10 to-transparent',
      border: 'border-emerald-400/20',
      value: 'text-emerald-400'
    },
    red: {
      dot: 'bg-red-400',
      bg: 'bg-gradient-to-br from-red-400/10 to-transparent',
      border: 'border-red-400/20',
      value: 'text-red-400'
    }
  };
  
  const currentStyle = styles[accent];

  return (
    <div className={`bg-[#0a140e]/72 border border-white/10 rounded-[14px] p-5 relative overflow-hidden backdrop-blur-sm group shadow-lg transition-transform hover:-translate-y-0.5`}>
      <div className={`absolute top-0 right-0 bottom-0 w-32 ${currentStyle.bg} opacity-50 pointer-events-none rounded-r-[14px]`} />
      
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-semibold text-white/50 tracking-wider uppercase">{title}</h3>
        <div className={`w-2 h-2 rounded-full ${currentStyle.dot} shadow-[0_0_10px_currentColor]`} />
      </div>
      
      <div className={`text-3xl font-light mb-1 tracking-tight ${currentStyle.value}`}>
        {value}
      </div>
      
      <div className="text-[11px] text-white/40">
        {subText}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'FULL') {
    return <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold tracking-wider">FULL</span>;
  }
  if (status === 'PENDING') {
    return <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold tracking-wider">PENDING</span>;
  }
  return <span className="inline-block px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10 text-[10px] font-bold tracking-wider">{status}</span>;
}
