import React, { useState, useEffect, useRef } from 'react';
import {
  Menu, X, RefreshCw, ChevronLeft, ChevronRight, FileText, Settings,
  CircleDot, ChevronDown, Eye, ShoppingCart, Calendar, Package
} from 'lucide-react';
import { branding, currentDay, last7Days } from '../mockData';
import { getThemeById } from '../themes';
import SettingsPage from './SettingsPage';
import { PackagesTiersPage, ClientActivationsPage } from './PlatformAdmin';
import RoomVisualizer from './RoomVisualizer';
import PosBilling from './PosBilling';
import ChequeRegister from './ChequeRegister';
import CustomerCreditAging from './CustomerCreditAging';
import InventoryGrn from './InventoryGrn';
import Quotations from './Quotations';
import StaffCommissions from './StaffCommissions';
import DailyCashReconciliation from './DailyCashReconciliation';
import LaylaAiAssistant from './LaylaAiAssistant';

type NavItem = {
  label: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard Home' },
      { label: 'Virtual Room Visualizer' },
      { label: 'Reports & Analytics' }
    ]
  },
  {
    title: 'Operations',
    items: [
      { label: 'POS Billing' },
      { label: 'Credit & Aging' },
      { label: 'Cheques (PDC)' },
      { label: 'Inventory & GRN' },
      { label: 'Quotations' }
    ]
  },
  {
    title: 'Finance & Staff',
    items: [
      { label: 'Cash Reconciliation' },
      { label: 'Staff & Commission' },
      { label: 'Layla AI Copilot' }
    ]
  },
  {
    title: 'Platform Admin',
    items: [
      { label: 'Packages & Tiers' },
      { label: 'Client Activations' }
    ]
  }
];

export default function DashboardApp() {
  const [currentPage, setCurrentPage] = useState('Dashboard Home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('app_theme') || 'nature');
  const [showDayReportModal, setShowDayReportModal] = useState(false);
  const themeContainerRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const navigateTo = (page: string) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const container = themeContainerRef.current;
    if (!container) return;

    container.innerHTML = '';
    const themeMod = getThemeById(activeTheme);
    let cleanup: { resize: () => void; dispose: () => void } | undefined;

    if (themeMod && themeMod.mount) {
      cleanup = themeMod.mount(container);
    }

    const onResize = () => cleanup?.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cleanup?.dispose();
    };
  }, [activeTheme]);

  return (
    <div className="min-h-screen text-white/90 font-sans relative overflow-x-hidden">
      {/* Background layer */}
      <div
        id="theme-layer"
        ref={themeContainerRef}
        className="fixed inset-0 -z-10 bg-gradient-to-br from-[#062e21] to-[#0a4531]"
      />

      {/* Top Shell Nav */}
      <nav className="sticky top-0 z-50 bg-[#0a140e]/80 backdrop-blur-xl border-b border-white/10 px-4 h-16 flex items-center justify-between">
        <div
          onClick={() => navigateTo('Dashboard Home')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#8a6e1d] flex items-center justify-center text-[#062e21] font-bold shadow-md">
            RB
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white group-hover:text-[#e8cf7a] transition-colors">
              {branding.company_name}
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
              Nature ERP · Thihariya
            </span>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navGroups.map(group => (
            <DropdownNav key={group.title} group={group} currentPage={currentPage} onNavigate={navigateTo} />
          ))}

          <div className="w-px h-6 bg-white/10 mx-2" />

          <button
            onClick={() => navigateTo('Virtual Room Visualizer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              currentPage === 'Virtual Room Visualizer'
                ? 'bg-[#d4af37] text-[#062e21] border-[#d4af37]'
                : 'bg-white/5 border-white/10 text-[#e8cf7a] hover:bg-white/10'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Room Visualizer</span>
          </button>

          <button
            onClick={() => navigateTo('Settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              currentPage === 'Settings' ? 'bg-white/15 text-[#d4af37]' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>

        {/* Right Icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast('Data refreshed')}
            className="p-2 rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors lg:flex hidden"
            title="Refresh ERP data"
          >
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
        <div className="fixed inset-0 top-16 z-40 bg-[#062e21]/95 backdrop-blur-2xl border-t border-white/10 overflow-y-auto lg:hidden">
          <div className="p-4 flex flex-col gap-6 pb-24">
            {navGroups.map(group => (
              <div key={group.title} className="flex flex-col gap-2">
                <div className="text-[11px] font-bold text-[#e8cf7a] uppercase tracking-wider mb-1">{group.title}</div>
                {group.items.map(item => (
                  <button
                    key={item.label}
                    onClick={() => navigateTo(item.label)}
                    className={`text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                      currentPage === item.label ? 'bg-white/10 text-[#d4af37] font-semibold' : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}

            <div className="w-full h-px bg-white/10 my-1" />

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
          <h1 className="text-2xl font-bold text-white tracking-tight">{currentPage}</h1>
          <div className="text-xs text-white/50 mt-1">
            {currentPage === 'Dashboard Home'
              ? 'Real-time overview of showroom sales, cash proof, and operating margins.'
              : `${currentPage} module loaded and active.`}
          </div>
        </div>

        {/* Dynamic Route Switching */}
        {currentPage === 'Dashboard Home' ? (
          <HomeContent
            onReportClick={() => setShowDayReportModal(true)}
            onNavigate={navigateTo}
          />
        ) : currentPage === 'Virtual Room Visualizer' ? (
          <RoomVisualizer />
        ) : currentPage === 'POS Billing' ? (
          <PosBilling />
        ) : currentPage === 'Cheques (PDC)' ? (
          <ChequeRegister />
        ) : currentPage === 'Credit & Aging' ? (
          <CustomerCreditAging />
        ) : currentPage === 'Inventory & GRN' ? (
          <InventoryGrn />
        ) : currentPage === 'Quotations' ? (
          <Quotations />
        ) : currentPage === 'Staff & Commission' ? (
          <StaffCommissions />
        ) : currentPage === 'Cash Reconciliation' ? (
          <DailyCashReconciliation />
        ) : currentPage === 'Layla AI Copilot' ? (
          <LaylaAiAssistant />
        ) : currentPage === 'Packages & Tiers' ? (
          <PackagesTiersPage />
        ) : currentPage === 'Client Activations' ? (
          <ClientActivationsPage />
        ) : currentPage === 'Settings' ? (
          <SettingsPage onThemeChange={t => setActiveTheme(t)} />
        ) : (
          <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center min-h-[350px] text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37] mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{currentPage}</h3>
            <p className="text-xs text-white/40 max-w-sm mb-4">
              Integrated with Royal Bath Hub core ledger. Use the navigation to access live modules.
            </p>
            <button
              onClick={() => navigateTo('Dashboard Home')}
              className="px-4 py-2 rounded-lg bg-[#d4af37] text-[#062e21] text-xs font-bold"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </main>

      {/* Day Report Modal */}
      {showDayReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#062e21] border border-[#d4af37]/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-start pb-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white">Official Day Close Report</h3>
                <p className="text-xs text-white/50">{branding.company_name} · Date: {currentDay.date}</p>
              </div>
              <button onClick={() => setShowDayReportModal(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 flex flex-col gap-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/60">Total Showroom Sales:</span>
                <span className="font-bold text-white">{branding.currency_symbol} {currentDay.total_sale.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/60">Invoices Generated:</span>
                <span className="font-mono text-white">{currentDay.invoices} bills</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/60">Operating & Petty Expenses:</span>
                <span className="text-amber-400 font-mono">-{branding.currency_symbol} {currentDay.expenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/60">Verified Net Profit:</span>
                <span className="text-emerald-400 font-bold">{branding.currency_symbol} {currentDay.net_profit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/60">Physical Cash Balance Verified:</span>
                <span className="text-[#d4af37] font-bold">{branding.currency_symbol} {currentDay.cash_in_hand.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowDayReportModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white/60 hover:bg-white/10"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                  setShowDayReportModal(false);
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#d4af37] text-[#062e21] hover:bg-[#ebd075] flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Print / Export PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#0a140e]/95 border border-[#d4af37]/40 text-white px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 z-50">
          <div className="w-2 h-2 rounded-full bg-[#d4af37]" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

const DropdownNav: React.FC<{ group: NavGroup; currentPage: string; onNavigate: (p: string) => void }> = ({
  group,
  currentPage,
  onNavigate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  const isActive = group.items.some(i => i.label === currentPage);

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          isActive || isOpen ? 'text-white bg-white/10' : 'text-white/70 hover:bg-white/5 hover:text-white'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{group.title}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''} opacity-50`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-[#0a140e]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 z-50">
          {group.items.map(item => (
            <button
              key={item.label}
              onClick={() => {
                onNavigate(item.label);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                currentPage === item.label
                  ? 'bg-white/10 text-[#d4af37] font-semibold'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function HomeContent({ onReportClick, onNavigate }: { onReportClick: () => void; onNavigate: (p: string) => void }) {
  const formatMoney = (val: number) => `${branding.currency_symbol} ${val.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Control Cluster */}
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-1.5">
          <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative group">
            <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold flex items-center gap-2 group-hover:bg-white/10 transition-colors">
              Mon 09 Jun 2026
            </div>
            <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>

          <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />

          <button
            className="p-2 text-[#d4af37]/70 hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-colors hidden sm:flex items-center gap-1"
            title="Jump to latest closed day"
          >
            <CircleDot className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('POS Billing')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            + New Sale
          </button>

          <button
            onClick={onReportClick}
            className="bg-[#d4af37] text-[#062e21] px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#ebd075] transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            DAY REPORT
          </button>
        </div>
      </div>

      {/* 2. KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Sale"
          value={formatMoney(currentDay.total_sale)}
          subText={`${currentDay.invoices} invoices`}
          accent="gold"
        />

        <KpiCard
          title="Expenses"
          value={formatMoney(currentDay.expenses)}
          subText={`${currentDay.expense_entries} verified entries`}
          accent="amber"
        />

        <KpiCard
          title="Net Profit"
          value={formatMoney(currentDay.net_profit)}
          subText="after all expenses & GP blend"
          accent={currentDay.net_profit >= 0 ? 'green' : 'red'}
        />

        <KpiCard
          title="Cash In Hand"
          value={formatMoney(currentDay.cash_in_hand)}
          subText={`expected ${formatMoney(currentDay.cash_expected)}`}
          accent={currentDay.cash_in_hand >= currentDay.cash_expected ? 'green' : 'red'}
        />
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('Virtual Room Visualizer')}
          className="bg-[#0a140e]/75 border border-[#d4af37]/30 hover:border-[#d4af37] rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#d4af37]/20 flex items-center justify-center text-[#d4af37]">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-[#e8cf7a] transition-colors">
                Virtual Room Visualizer
              </h4>
              <p className="text-[11px] text-white/50">3D room preview with wall & floor tiles</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => onNavigate('Cheques (PDC)')}
          className="bg-[#0a140e]/75 border border-white/10 hover:border-[#d4af37]/50 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-[#e8cf7a] transition-colors">
                Cheques & PDC Tracker
              </h4>
              <p className="text-[11px] text-white/50">Monitor deposit dates & bank clearings</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => onNavigate('Layla AI Copilot')}
          className="bg-[#0a140e]/75 border border-white/10 hover:border-[#d4af37]/50 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-[#e8cf7a] transition-colors">
                Layla AI Assistant
              </h4>
              <p className="text-[11px] text-white/50">Natural language insights on stock & sales</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Last 7 Days Audit Table */}
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden flex flex-col shadow-xl">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#e8cf7a] tracking-widest uppercase">
            Last 7 Days Operating Log
          </h2>
          <span className="text-[11px] text-white/40">Audit Trail · Reconciled Daily</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-white/40 bg-black/20">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium text-right">Sale</th>
                <th className="px-5 py-3 font-medium text-right">Expenses</th>
                <th className="px-5 py-3 font-medium text-right">Net Profit</th>
                <th className="px-5 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {last7Days.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors last:border-0">
                  <td className="px-5 py-3.5 font-medium text-white/90">{row.date}</td>
                  <td className="px-5 py-3.5 text-right text-white/80">{formatMoney(row.sale)}</td>
                  <td className="px-5 py-3.5 text-right text-white/80">{formatMoney(row.expenses)}</td>
                  <td className={`px-5 py-3.5 text-right font-bold ${row.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(row.net_profit)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      row.status === 'FULL'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : row.status === 'PENDING'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-white/5 text-white/50 border border-white/10'
                    }`}>
                      {row.status}
                    </span>
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

function KpiCard({
  title,
  value,
  subText,
  accent
}: {
  title: string;
  value: string;
  subText: string;
  accent: 'gold' | 'amber' | 'green' | 'red';
}) {
  const styles = {
    gold: {
      dot: 'bg-[#d4af37]',
      bg: 'bg-gradient-to-br from-[#d4af37]/10 to-transparent',
      value: 'text-white'
    },
    amber: {
      dot: 'bg-amber-400',
      bg: 'bg-gradient-to-br from-amber-400/10 to-transparent',
      value: 'text-white'
    },
    green: {
      dot: 'bg-emerald-400',
      bg: 'bg-gradient-to-br from-emerald-400/10 to-transparent',
      value: 'text-emerald-400'
    },
    red: {
      dot: 'bg-red-400',
      bg: 'bg-gradient-to-br from-red-400/10 to-transparent',
      value: 'text-red-400'
    }
  };

  const currentStyle = styles[accent];

  return (
    <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md group shadow-lg transition-transform hover:-translate-y-0.5">
      <div className={`absolute top-0 right-0 bottom-0 w-32 ${currentStyle.bg} opacity-50 pointer-events-none rounded-r-2xl`} />

      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-semibold text-white/50 tracking-wider uppercase">{title}</h3>
        <div className={`w-2 h-2 rounded-full ${currentStyle.dot} shadow-[0_0_10px_currentColor]`} />
      </div>

      <div className={`text-2xl sm:text-3xl font-light mb-1 tracking-tight ${currentStyle.value}`}>
        {value}
      </div>

      <div className="text-[11px] text-white/40">
        {subText}
      </div>
    </div>
  );
}
