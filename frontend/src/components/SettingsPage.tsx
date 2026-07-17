import React, { useState } from 'react';
import { THEME_REGISTRY } from '../themes';

// --- MOCK DATA ---
const initialUsers = [
  { username: 'owner', name: 'Alex Demo', role: 'admin', created: '2026-06-01' },
  { username: 'sam', name: 'Sam Placeholder', role: 'staff', created: '2026-06-02' },
  { username: 'jordan', name: 'Jordan Test', role: 'staff', created: '2026-06-03' },
];

const supportContact = {
  name: "Demo Vendor Support",
  phone: "+00 000 0000",
  email: "support@example.com"
};

const initialFlags = {
  pos_billing: { label: 'POS Billing', desc: 'Barcode-scan counter billing', on: false },
  inv_barcode_labels: { label: 'Barcode Labels', desc: 'Printable shelf/product labels', on: false },
  staff_commission_display: { label: 'Commission', desc: 'Staff commission figures page', on: false },
  ai_assistant_chat: { label: 'AI Assistant', desc: 'Ask questions about the business', on: false }
};

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 max-w-4xl mx-auto pb-12">
      <ChangePasswordCard />
      <UserManagementCard />
      <AppearanceCard />
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
    setMsg('Password updated (demo)');
    setIsError(false);
    setCurrent('');
    setNewPass('');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] p-5 backdrop-blur-sm shadow-lg">
      <SectionTitle>Change Password</SectionTitle>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/60">Current Password</label>
          <input 
            type="password" 
            value={current} 
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full bg-black/25 border border-white/15 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#d4af37]/75 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/60">New Password</label>
          <input 
            type="password" 
            value={newPass} 
            onChange={(e) => setNewPass(e.target.value)}
            className="w-full bg-black/25 border border-white/15 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#d4af37]/75 transition-colors"
          />
        </div>
        <div className="flex items-center gap-4 mt-2">
          <button type="submit" className="bg-[#d4af37] text-[#062e21] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#ebd075] transition-colors focus:ring-2 focus:ring-[#d4af37]/50">
            Update Password
          </button>
          {msg && <span className={`text-sm ${isError ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</span>}
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
    <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] overflow-hidden backdrop-blur-sm shadow-lg flex flex-col">
      <div className="p-5 border-b border-white/5">
        <SectionTitle>User Management</SectionTitle>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px] flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60">Username</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/75" />
          </div>
          <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60">Full name</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/75" />
          </div>
          <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60">Password</label>
            <input type="password" placeholder="Min 12 chars" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/75" />
          </div>
          <div className="w-32 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60">Role</label>
            <select value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#d4af37]/75 appearance-none">
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="customer">Customer</option>
            </select>
          </div>
          <div className="w-full sm:w-auto mt-2 sm:mt-0 flex items-center gap-3">
            <button type="submit" className="w-full sm:w-auto bg-[#d4af37] text-[#062e21] px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#ebd075] transition-colors whitespace-nowrap">
              + Add User
            </button>
            {msg && <span className={`text-xs ${msg.includes('added') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</span>}
          </div>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] whitespace-nowrap">
          <thead>
            <tr className="border-b border-white/10 text-white/40">
              <th className="px-5 py-3 font-medium">Username</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium text-right">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors last:border-0">
                <td className="px-5 py-3 font-medium text-white/90">{u.username}</td>
                <td className="px-5 py-3 text-white/80">{u.name}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/60 text-[10px] uppercase tracking-wider border border-white/10">{u.role}</span>
                </td>
                <td className="px-5 py-3 text-right text-white/50">{u.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AppearanceCard() {
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'nature');
  const [msg, setMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTheme(val);
    localStorage.setItem('app_theme', val);
    setMsg('Theme updated (real engine hooks later)');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] p-5 backdrop-blur-sm shadow-lg">
      <SectionTitle>Appearance</SectionTitle>
      <HelperText>Background theme for the Dashboard and Login screen only — no data, pages, or reports change.</HelperText>
      
      <div className="flex items-center gap-4 max-w-sm mt-4">
        <select value={theme} onChange={handleChange} className="flex-1 bg-black/25 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]/75 appearance-none">
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
    <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] p-5 backdrop-blur-sm shadow-lg flex flex-col">
      <SectionTitle>Feature Flags</SectionTitle>
      <HelperText>New modules ship OFF by default. Registry is DB-backed — visible and effective for every user, not just this browser.</HelperText>
      
      <div className="flex flex-col gap-3 mt-4">
        {(Object.keys(flags) as Array<keyof typeof flags>).map(k => {
          const f = flags[k];
          return (
            <div key={k} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white/90">{f.label}</span>
                <span className="text-xs text-white/40">{f.desc}</span>
              </div>
              <div className="flex items-center gap-3">
                {f.on ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold tracking-wider border border-emerald-500/20 uppercase">ON</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold tracking-wider border border-amber-500/20 uppercase">OFF</span>
                )}
                
                <button 
                  onClick={() => toggleFlag(k)}
                  className={`w-[38px] h-[20px] rounded-full p-[2px] transition-colors focus:outline-none ${f.on ? 'bg-emerald-500/50' : 'bg-white/20'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${f.on ? 'translate-x-[18px]' : 'translate-x-0'}`} />
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
    <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] p-5 backdrop-blur-sm shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <SectionTitle>Report a Problem</SectionTitle>
        <span className="text-lg -mt-4">🛟</span>
      </div>
      
      <HelperText>Something broken or behaving strangely? Here's who to contact and how fast to expect a response.</HelperText>
      
      <div className="flex flex-wrap gap-x-8 gap-y-2 mb-6 text-[13px] text-white/80 bg-white/5 p-4 rounded-xl border border-white/10">
        <div><span className="text-white/40">Contact:</span> {supportContact.name || '____________'}</div>
        <div><span className="text-white/40">Phone:</span> {supportContact.phone || '____________'}</div>
        <div><span className="text-white/40">Email:</span> {supportContact.email || '____________'}</div>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-left text-[13px] border border-white/10 rounded-lg overflow-hidden border-collapse">
          <thead>
            <tr className="bg-black/20 text-white/60">
              <th className="px-4 py-2 font-medium border-b border-white/10">Severity</th>
              <th className="px-4 py-2 font-medium border-b border-white/10">Examples</th>
              <th className="px-4 py-2 font-medium border-b border-white/10">Response & fix target</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5">
              <td className="px-4 py-2 text-red-400 font-medium">Critical / Security</td>
              <td className="px-4 py-2 text-white/70">System down, login broken, data at risk</td>
              <td className="px-4 py-2 text-white"><strong>2–3 hours</strong> (remote-first)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="px-4 py-2 text-amber-400 font-medium">Major bug</td>
              <td className="px-4 py-2 text-white/70">Sales, expenses or reports giving wrong results</td>
              <td className="px-4 py-2 text-white"><strong>2–3 hours</strong> (remote-first)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="px-4 py-2 text-emerald-400 font-medium">Minor issue / small request</td>
              <td className="px-4 py-2 text-white/70">Cosmetic problems, wording, small tweaks</td>
              <td className="px-4 py-2 text-white/90">4–5 business days</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-blue-400 font-medium">New feature</td>
              <td className="px-4 py-2 text-white/70">Anything the system doesn't do today</td>
              <td className="px-4 py-2 text-white/50 italic">Separate quotation — not under support</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <HelperText>When reporting: say what you were doing, what you expected, and what happened instead — a photo of the screen helps. For critical issues, call or WhatsApp directly.</HelperText>
    </div>
  );
}
