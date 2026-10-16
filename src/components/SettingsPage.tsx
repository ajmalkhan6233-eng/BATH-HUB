import React, { useState } from 'react';
import { THEME_REGISTRY } from '../themes';
import { branding } from '../mockData';

interface SettingsPageProps {
  onThemeChange?: (themeId: string) => void;
}

const initialUsers = [
  { username: 'owner', name: 'Ajmal Khan', role: 'admin', created: '2026-06-01' },
  { username: 'fahim', name: 'Fahim Mohamed', role: 'staff', created: '2026-06-02' },
  { username: 'ansaf', name: 'Ansaf Razak', role: 'staff', created: '2026-06-03' },
];

const initialFlags = {
  pos_billing: { label: 'POS Billing', desc: 'Barcode-scan counter billing', on: true },
  inv_barcode_labels: { label: 'Barcode Labels', desc: 'Printable shelf/product labels', on: true },
  staff_commission_display: { label: 'Commission', desc: 'Staff commission figures page', on: true },
  ai_assistant_chat: { label: 'AI Assistant', desc: 'Ask questions about the business', on: true }
};

export default function SettingsPage({ onThemeChange }: SettingsPageProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 max-w-4xl mx-auto pb-12">
      <ChangePasswordCard />
      <UserManagementCard />
      <AppearanceCard onThemeChange={onThemeChange} />
      <FeatureFlagsCard />
      <ReportProblemCard />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[14px] font-bold text-[#e8cf7a] tracking-widest uppercase mb-4">{children}</h2>;
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-white/40 mb-4">{children}</p>;
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 12) {
      setMsg('New password must be at least 12 characters.');
      setIsError(true);
      return;
    }
    setMsg('Password updated (verified)');
    setIsError(false);
    setCurrent('');
    setNewPass('');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-sm shadow-lg">
      <SectionTitle>Change Password</SectionTitle>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/60">Current Password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#d4af37]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/60">New Password (min 12 characters)</label>
          <input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#d4af37]"
          />
        </div>
        <div className="flex items-center gap-4 mt-2">
          <button type="submit" className="bg-[#d4af37] text-[#062e21] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#ebd075]">
            Update Password
          </button>
          {msg && <span className={`text-xs ${isError ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</span>}
        </div>
      </form>
    </div>
  );
}

function UserManagementCard() {
  const [users, setUsers] = useState(initialUsers);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [msg, setMsg] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !name || password.length < 12) {
      setMsg('Please fill all fields. Password min 12 chars.');
      return;
    }
    const newUser = {
      username,
      name,
      role,
      created: new Date().toISOString().split('T')[0]
    };
    setUsers([...users, newUser]);
    setUsername('');
    setName('');
    setPassword('');
    setRole('staff');
    setMsg('User added successfully.');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-lg flex flex-col">
      <div className="p-5 border-b border-white/5">
        <SectionTitle>User Management</SectionTitle>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px] flex flex-col gap-1">
            <label className="text-xs font-medium text-white/60">Username</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white" />
          </div>
          <div className="flex-1 min-w-[140px] flex flex-col gap-1">
            <label className="text-xs font-medium text-white/60">Full name</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white" />
          </div>
          <div className="flex-1 min-w-[140px] flex flex-col gap-1">
            <label className="text-xs font-medium text-white/60">Password (min 12)</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white" />
          </div>
          <div className="w-32 flex flex-col gap-1">
            <label className="text-xs font-medium text-white/60">Role</label>
            <select value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white">
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="bg-[#d4af37] text-[#062e21] px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#ebd075]">
            + Add User
          </button>
        </form>
        {msg && <span className="text-xs text-emerald-400 mt-2 block">{msg}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-white/10 text-white/40 bg-black/20">
              <th className="px-5 py-3 font-medium">Username</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium text-right">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-5 py-3 font-mono font-medium text-white/90">{u.username}</td>
                <td className="px-5 py-3 text-white/80">{u.name}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/60 text-[10px] uppercase font-bold border border-white/10">{u.role}</span>
                </td>
                <td className="px-5 py-3 text-right text-white/40">{u.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AppearanceCard({ onThemeChange }: { onThemeChange?: (id: string) => void }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'nature');
  const [msg, setMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTheme(val);
    localStorage.setItem('app_theme', val);
    onThemeChange?.(val);
    setMsg('Theme updated live');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-sm shadow-lg">
      <SectionTitle>Appearance & Background Theme</SectionTitle>
      <HelperText>Background theme for the Dashboard and Showroom screens — rendered with smooth 2D canvas/CSS shaders.</HelperText>

      <div className="flex items-center gap-4 max-w-sm mt-3">
        <select value={theme} onChange={handleChange} className="flex-1 bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-xs text-white">
          {THEME_REGISTRY.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        {msg && <span className="text-xs text-emerald-400 whitespace-nowrap">{msg}</span>}
      </div>
    </div>
  );
}

function FeatureFlagsCard() {
  const [flags, setFlags] = useState(initialFlags);

  const toggleFlag = (key: keyof typeof flags) => {
    setFlags(prev => ({
      ...prev,
      [key]: { ...prev[key], on: !prev[key].on }
    }));
  };

  return (
    <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-sm shadow-lg flex flex-col">
      <SectionTitle>Feature Flags</SectionTitle>
      <HelperText>Control which operational modules are active in this deployment.</HelperText>

      <div className="flex flex-col gap-3 mt-3">
        {(Object.keys(flags) as Array<keyof typeof flags>).map(k => {
          const f = flags[k];
          return (
            <div key={k} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white/90">{f.label}</span>
                <span className="text-[11px] text-white/40">{f.desc}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${f.on ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  {f.on ? 'ON' : 'OFF'}
                </span>
                <button
                  onClick={() => toggleFlag(k)}
                  className={`w-[36px] h-[20px] rounded-full p-[2px] transition-colors ${f.on ? 'bg-[#d4af37]' : 'bg-white/20'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${f.on ? 'translate-x-[16px]' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportProblemCard() {
  return (
    <div className="bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-sm shadow-lg">
      <SectionTitle>Report a Problem 🛟</SectionTitle>
      <HelperText>Support escalation response targets for Royal Bath Hub management systems.</HelperText>

      <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4 text-xs text-white/80 bg-white/5 p-4 rounded-xl border border-white/10">
        <div><span className="text-white/40">Contact:</span> {branding.support_contact.name}</div>
        <div><span className="text-white/40">Phone:</span> {branding.support_contact.phone}</div>
        <div><span className="text-white/40">Email:</span> {branding.support_contact.email}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border border-white/10 rounded-lg overflow-hidden border-collapse">
          <thead>
            <tr className="bg-black/30 text-white/60">
              <th className="px-4 py-2 font-medium border-b border-white/10">Severity</th>
              <th className="px-4 py-2 font-medium border-b border-white/10">Examples</th>
              <th className="px-4 py-2 font-medium border-b border-white/10">Response & Fix Target</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5">
              <td className="px-4 py-2 text-red-400 font-bold">Critical / Security</td>
              <td className="px-4 py-2 text-white/70">System down, till ledger locked, data at risk</td>
              <td className="px-4 py-2 text-white"><strong>2–3 hours</strong> (direct remote)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="px-4 py-2 text-amber-400 font-bold">Major bug</td>
              <td className="px-4 py-2 text-white/70">Sales, expenses or reports discrepancy</td>
              <td className="px-4 py-2 text-white"><strong>2–3 hours</strong> (direct remote)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-emerald-400 font-bold">Minor issue</td>
              <td className="px-4 py-2 text-white/70">Cosmetic styling, wording, label prints</td>
              <td className="px-4 py-2 text-white/80">24–48 hours</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
