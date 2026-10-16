import React, { useState } from 'react';
import { Package, Server, Check, X, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const mockPackages = [
  { id: 1, name: 'Basic POS', price: 500, features: 'Sales, Receipts, End of day' },
  { id: 2, name: 'Inventory Lite', price: 1000, features: 'Stock levels, Basic GRN' },
  { id: 3, name: 'Standard ERP', price: 2000, features: 'POS, Inventory, Basic reports' },
  { id: 4, name: 'Advanced Analytics', price: 3000, features: 'Standard ERP + AI Insights' },
  { id: 5, name: 'Multi-Store Manager', price: 4500, features: 'Advanced Analytics + Multi-branch' },
  {
    id: 6,
    name: 'FULL ERP — Retail Command Suite',
    badge: 'PREMIUM',
    price: 6000,
    features: 'POS + invoicing, inventory & GRN, daily cash reconciliation, staff commissions, supplier & credit tracking, customer ledgers, WhatsApp AI assistant, multi-theme dashboard'
  },
];

export function PackagesTiersPage() {
  const [packages, setPackages] = useState(mockPackages);

  const updatePrice = (id: number, newPrice: number) => {
    setPackages(packages.map(p => p.id === id ? { ...p, price: newPrice } : p));
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-lg">
        <h2 className="text-[14px] font-bold text-[#e8cf7a] tracking-widest uppercase mb-6 flex items-center gap-2">
          <Package className="w-5 h-5" /> Packages & Tiers
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map(pkg => (
            <div key={pkg.id} className={`p-5 rounded-xl border ${pkg.badge === 'PREMIUM' ? 'border-[#d4af37]/50 bg-[#d4af37]/5' : 'border-white/10 bg-black/20'} flex flex-col relative overflow-hidden group`}>
              {pkg.badge && (
                <div className="absolute top-0 right-0 bg-[#d4af37] text-[#062e21] text-[10px] font-bold px-2 py-1 tracking-wider rounded-bl-lg">
                  {pkg.badge}
                </div>
              )}
              <div className="text-xs text-white/50 mb-1">Package {pkg.id}</div>
              <h3 className={`font-semibold text-base mb-3 ${pkg.badge === 'PREMIUM' ? 'text-[#d4af37]' : 'text-white'}`}>{pkg.name}</h3>

              <div className="mt-auto pt-4 flex flex-col gap-3">
                <div className="text-xs text-white/60 leading-relaxed min-h-[40px]">
                  {pkg.features}
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-2">
                  <span className="text-xs font-medium text-white/60">Price ($)</span>
                  <input
                    type="number"
                    value={pkg.price}
                    onChange={(e) => updatePrice(pkg.id, Number(e.target.value))}
                    className="w-24 bg-black/25 border border-white/15 rounded-lg px-2 py-1 text-right text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const initialClients = [
  { id: 1, name: 'Royal Bath Hub (Thihariya)', packageId: 6, active: true, status: 'Active' },
  { id: 2, name: 'Colombo Tile Mart', packageId: 3, active: false, status: 'Suspended' },
  { id: 3, name: 'Kandy Sanitary Gallery', packageId: 2, active: true, status: 'Active' }
];

export function ClientActivationsPage() {
  const [clients, setClients] = useState(initialClients);
  const [modalClient, setModalClient] = useState<number | null>(null);

  const [provisionForm, setProvisionForm] = useState({
    shopName: '',
    subdomain: '',
    adminEmail: '',
    currency: 'LKR'
  });

  const [provisionStatus, setProvisionStatus] = useState<'idle' | 'success'>('idle');

  const handleToggle = (clientId: number, currentActive: boolean, currentPackageId: number) => {
    if (!currentActive && currentPackageId === 6) {
      const client = clients.find(c => c.id === clientId);
      setProvisionForm(f => ({ ...f, shopName: client?.name || '' }));
      setProvisionStatus('idle');
      setModalClient(clientId);
    } else {
      setClients(clients.map(c => c.id === clientId ? {
        ...c,
        active: !currentActive,
        status: !currentActive ? 'Active' : 'Suspended'
      } : c));
    }
  };

  const handlePackageChange = (clientId: number, newPackageId: number) => {
    setClients(clients.map(c => c.id === clientId ? { ...c, packageId: newPackageId } : c));
  };

  const handleProvisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalClient === null) return;

    setProvisionStatus('success');

    setTimeout(() => {
      setClients(clients.map(c => c.id === modalClient ? {
        ...c,
        active: true,
        status: 'Active'
      } : c));
      setModalClient(null);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
      <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-lg flex flex-col">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[#e8cf7a] tracking-widest uppercase flex items-center gap-2">
            <Server className="w-5 h-5" /> Client Activations
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/10 text-white/40 bg-black/20">
                <th className="px-5 py-3 font-medium">Client / Branch Name</th>
                <th className="px-5 py-3 font-medium">Package Tier</th>
                <th className="px-5 py-3 font-medium text-center">Activation</th>
                <th className="px-5 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-semibold text-white/90">{client.name}</td>
                  <td className="px-5 py-4">
                    <select
                      value={client.packageId}
                      onChange={(e) => handlePackageChange(client.id, Number(e.target.value))}
                      className="bg-black/25 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white"
                    >
                      {mockPackages.map(p => (
                        <option key={p.id} value={p.id}>{p.id}. {p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => handleToggle(client.id, client.active, client.packageId)}
                        className={`w-[36px] h-[20px] rounded-full p-[2px] transition-colors ${client.active ? 'bg-[#d4af37]' : 'bg-white/20'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${client.active ? 'translate-x-[16px]' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      client.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/40 border border-white/10'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalClient !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#062e21] border border-[#d4af37]/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="text-base font-semibold text-white">Provision Instance</h3>
              <button onClick={() => setModalClient(null)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {provisionStatus === 'idle' ? (
              <form onSubmit={handleProvisionSubmit} className="p-6 flex flex-col gap-4">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                  <div>Activating <strong>FULL ERP</strong> will provision a dedicated branch instance.</div>
                </div>

                <Input
                  label="Shop Name"
                  value={provisionForm.shopName}
                  onChange={e => setProvisionForm(f => ({ ...f, shopName: e.target.value }))}
                  required
                />

                <Input
                  label="Admin Email"
                  type="email"
                  value={provisionForm.adminEmail}
                  onChange={e => setProvisionForm(f => ({ ...f, adminEmail: e.target.value }))}
                  required
                />

                <div className="flex justify-end gap-3 mt-4">
                  <Button type="button" variant="ghost" onClick={() => setModalClient(null)}>Cancel</Button>
                  <Button type="submit">Provision Now</Button>
                </div>
              </form>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
                  <Check className="w-7 h-7" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Instance Provisioned</h3>
                <p className="text-xs text-white/50">Dedicated showroom instance is active and ready.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
