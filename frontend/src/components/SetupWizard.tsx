import React, { useState, ChangeEvent, FormEvent, useRef } from 'react';
import { Check, Upload, Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import { SetupPayload, StaffMember } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface SetupWizardProps {
  onComplete?: (payload: SetupPayload) => void;
  onDone?: () => void;
}

export default function SetupWizard({ onComplete, onDone }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [payload, setPayload] = useState<SetupPayload>({
    company_name: '',
    legal_name: '',
    tagline: '',
    logo_data_url: null,
    currency: 'USD',
    currency_symbol: '$',
    admin: { name: '', username: '', password: '' },
    staff: []
  });

  const totalSteps = 4;
  const isDone = step > totalSteps;

  const handleNext = () => {
    setErrorMsg('');
    
    // Validations
    if (step === 1 && !payload.company_name.trim()) {
      setErrorMsg('Business name is required.');
      return;
    }
    
    if (step === 3) {
      if (!payload.admin.username.trim()) {
        setErrorMsg('Admin username is required.');
        return;
      }
      if (payload.admin.password.length < 8) {
        setErrorMsg('Admin password must be at least 8 characters.');
        return;
      }
    }

    if (step === totalSteps) {
      // Validate staff (optional, but if added, they should have username/password)
      const invalidStaff = payload.staff.some(s => !s.username.trim() || s.password.length < 8);
      if (invalidStaff) {
        setErrorMsg('All staff must have a username and a password of at least 8 characters.');
        return;
      }
      
      onComplete?.(payload);
    }
    
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setErrorMsg('');
    setStep(s => Math.max(1, s - 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  if (isDone) {
    return (
      <div className="w-full max-w-[520px] bg-white/5 border border-[#d4af37]/25 rounded-2xl p-8 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[#d4af37]/20 flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-[#d4af37]" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">Setup complete</h2>
        <p className="text-white/70 mb-8">
          You are logged in as <span className="text-white font-medium">{payload.admin.username}</span>.
        </p>
        <Button onClick={onDone} className="w-full">
          Open your dashboard <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[520px] bg-white/5 border border-[#d4af37]/25 rounded-2xl p-8 backdrop-blur-md relative shadow-2xl" onKeyDown={handleKeyDown}>
      {/* Step Progress */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div 
            key={i} 
            className={`h-1 flex-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-[#d4af37]' : 'bg-white/12'}`} 
          />
        ))}
      </div>

      <div className="min-h-[320px] flex flex-col">
        {step === 1 && (
          <Step1 
            payload={payload} 
            onChange={(updates) => setPayload(p => ({ ...p, ...updates }))} 
          />
        )}
        {step === 2 && (
          <Step2 
            payload={payload} 
            onChange={(updates) => setPayload(p => ({ ...p, ...updates }))} 
            setErrorMsg={setErrorMsg}
          />
        )}
        {step === 3 && (
          <Step3 
            payload={payload} 
            onChange={(updates) => setPayload(p => ({ ...p, ...updates }))} 
          />
        )}
        {step === 4 && (
          <Step4 
            payload={payload} 
            onChange={(updates) => setPayload(p => ({ ...p, ...updates }))} 
          />
        )}
        
        <div className="mt-auto pt-8">
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="ghost" onClick={handleBack} className="w-12 px-0 shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <Button onClick={handleNext} className="flex-1">
              {step === totalSteps ? 'Finish setup' : 'Next'}
            </Button>
          </div>
          
          {errorMsg && (
            <div className="text-sm text-red-400 mt-4 text-center">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components for steps ---

function Step1({ payload, onChange }: { payload: SetupPayload, onChange: (u: Partial<SetupPayload>) => void }) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-2xl font-semibold text-white mb-2">Welcome — let's set up your system</h2>
      <p className="text-sm text-white/60 mb-6">This one-time wizard prepares this ERP for your business.</p>
      
      <div className="flex flex-col gap-4">
        <Input 
          label="Business name *" 
          placeholder="e.g. Demo Hardware Store" 
          value={payload.company_name}
          onChange={e => onChange({ company_name: e.target.value })}
          autoFocus
        />
        <Input 
          label="Legal name" 
          placeholder="e.g. Demo Hardware Store (Pvt) Ltd" 
          value={payload.legal_name}
          onChange={e => onChange({ legal_name: e.target.value })}
        />
        <Input 
          label="Tagline" 
          placeholder="e.g. Everything for your build — Main Street" 
          value={payload.tagline}
          onChange={e => onChange({ tagline: e.target.value })}
        />
      </div>
    </div>
  );
}

function Step2({ payload, onChange, setErrorMsg }: { payload: SetupPayload, onChange: (u: Partial<SetupPayload>) => void, setErrorMsg: (m: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Logo file must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ logo_data_url: event.target?.result as string });
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
      <h2 className="text-2xl font-semibold text-white mb-2">Logo & currency</h2>
      <p className="text-sm text-white/60 mb-6">Customize the brand identity and financials.</p>

      <div className="flex flex-col gap-6">
        <div>
          <label className="text-xs font-medium text-white/60 mb-1.5 block">Company Logo</label>
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-lg bg-black/25 border border-white/15 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#d4af37]/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {payload.logo_data_url ? (
                <img src={payload.logo_data_url} alt="Logo preview" className="w-full h-full object-contain" />
              ) : (
                <Upload className="w-6 h-6 text-white/30" />
              )}
            </div>
            <div className="text-xs text-white/50">
              PNG, JPEG, WebP, SVG. Max 2MB.
            </div>
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/webp, image/svg+xml"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <Input 
            label="Currency code" 
            placeholder="USD" 
            value={payload.currency}
            onChange={e => onChange({ currency: e.target.value })}
            className="flex-1"
          />
          <Input 
            label="Symbol" 
            placeholder="$" 
            value={payload.currency_symbol}
            onChange={e => onChange({ currency_symbol: e.target.value })}
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
}

function Step3({ payload, onChange }: { payload: SetupPayload, onChange: (u: Partial<SetupPayload>) => void }) {
  const updateAdmin = (updates: Partial<StaffMember>) => {
    onChange({ admin: { ...payload.admin, ...updates } });
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-2xl font-semibold text-white mb-2">Admin account</h2>
      <p className="text-sm text-white/60 mb-6">This is the account that controls everything. Store the password safely.</p>
      
      <div className="flex flex-col gap-4">
        <Input 
          label="Admin name" 
          placeholder="Owner name" 
          value={payload.admin.name}
          onChange={e => updateAdmin({ name: e.target.value })}
          autoFocus
        />
        <Input 
          label="Admin username *" 
          placeholder="e.g. owner" 
          value={payload.admin.username}
          onChange={e => updateAdmin({ username: e.target.value })}
        />
        <Input 
          label="Admin password *" 
          type="password"
          placeholder="Min 8 characters" 
          value={payload.admin.password}
          onChange={e => updateAdmin({ password: e.target.value })}
        />
      </div>
    </div>
  );
}

function Step4({ payload, onChange }: { payload: SetupPayload, onChange: (u: Partial<SetupPayload>) => void }) {
  const addStaff = () => {
    if (payload.staff.length >= 8) return;
    onChange({ staff: [...payload.staff, { name: '', username: '', password: '' }] });
  };

  const removeStaff = (index: number) => {
    const newStaff = [...payload.staff];
    newStaff.splice(index, 1);
    onChange({ staff: newStaff });
  };

  const updateStaff = (index: number, updates: Partial<StaffMember>) => {
    const newStaff = [...payload.staff];
    newStaff[index] = { ...newStaff[index], ...updates };
    onChange({ staff: newStaff });
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">Staff accounts <span className="text-white/40 text-lg font-normal">(optional)</span></h2>
          <p className="text-sm text-white/60">Create accounts for your team members.</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
        {payload.staff.map((staff, i) => (
          <div key={i} className="p-4 rounded-xl bg-black/20 border border-white/10 relative group">
            <button 
              onClick={() => removeStaff(i)}
              className="absolute top-3 right-3 text-white/30 hover:text-red-400 transition-colors"
              title="Remove staff member"
              tabIndex={-1}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="flex flex-col gap-3">
              <Input 
                label="Full name" 
                placeholder="Name" 
                value={staff.name}
                onChange={e => updateStaff(i, { name: e.target.value })}
              />
              <div className="flex gap-3">
                <Input 
                  label="Username" 
                  placeholder="Username" 
                  value={staff.username}
                  onChange={e => updateStaff(i, { username: e.target.value })}
                  className="flex-1"
                />
                <Input 
                  label="Password" 
                  type="password"
                  placeholder="Password" 
                  value={staff.password}
                  onChange={e => updateStaff(i, { password: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        ))}

        {payload.staff.length < 8 && (
          <Button variant="ghost" onClick={addStaff} className="border-dashed py-3 opacity-70 hover:opacity-100">
            <Plus className="w-4 h-4" /> Add staff member
          </Button>
        )}
      </div>
    </div>
  );
}
