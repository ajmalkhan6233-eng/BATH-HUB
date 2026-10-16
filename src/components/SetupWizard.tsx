import React, { useState, ChangeEvent, useRef } from 'react';
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
    company_name: 'Royal Bath Hub',
    legal_name: 'Royal Bath Hub (Pvt) Ltd',
    tagline: 'Tiles, Sanitaryware & Luxury Bathroom Fittings',
    logo_data_url: null,
    currency: 'LKR',
    currency_symbol: 'Rs',
    admin: { name: 'Ajmal Khan', username: 'owner', password: '' },
    staff: []
  });

  const totalSteps = 4;
  const isDone = step > totalSteps;

  const handleNext = () => {
    setErrorMsg('');

    if (step === 1 && !payload.company_name.trim()) {
      setErrorMsg('Business name is required.');
      return;
    }

    if (step === 3) {
      if (!payload.admin.username.trim()) {
        setErrorMsg('Admin username is required.');
        return;
      }
      if (payload.admin.password && payload.admin.password.length < 8) {
        setErrorMsg('Admin password must be at least 8 characters.');
        return;
      }
    }

    if (step === totalSteps) {
      onComplete?.(payload);
    }

    setStep(s => s + 1);
  };

  const handleBack = () => {
    setErrorMsg('');
    setStep(s => Math.max(1, s - 1));
  };

  if (isDone) {
    return (
      <div className="w-full max-w-[520px] bg-white/5 border border-[#d4af37]/25 rounded-2xl p-8 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[#d4af37]/20 flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-[#d4af37]" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Setup complete</h2>
        <p className="text-white/70 mb-8 text-sm">
          You are logged in as <span className="text-white font-medium">{payload.admin.username || 'owner'}</span>.
        </p>
        <Button onClick={onDone} className="w-full">
          Open your dashboard <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[520px] bg-white/5 border border-[#d4af37]/25 rounded-2xl p-8 backdrop-blur-md relative shadow-2xl">
      {/* Step Progress */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-[#d4af37]' : 'bg-white/15'}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Welcome — let's set up your system</h2>
            <p className="text-xs text-white/50">This one-time wizard prepares this ERP for your showroom.</p>
          </div>

          <Input
            label="Business name*"
            placeholder="e.g. Royal Bath Hub"
            value={payload.company_name}
            onChange={e => setPayload({ ...payload, company_name: e.target.value })}
          />
          <Input
            label="Legal name"
            placeholder="e.g. Royal Bath Hub (Pvt) Ltd"
            value={payload.legal_name}
            onChange={e => setPayload({ ...payload, legal_name: e.target.value })}
          />
          <Input
            label="Tagline"
            placeholder="e.g. Everything for your luxury build"
            value={payload.tagline}
            onChange={e => setPayload({ ...payload, tagline: e.target.value })}
          />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Branding & Currency</h2>
            <p className="text-xs text-white/50">Set currency symbols and invoice representation.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Currency Code"
              value={payload.currency}
              onChange={e => setPayload({ ...payload, currency: e.target.value })}
            />
            <Input
              label="Currency Symbol"
              value={payload.currency_symbol}
              onChange={e => setPayload({ ...payload, currency_symbol: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Owner / Admin Account</h2>
            <p className="text-xs text-white/50">This account controls everything. Store the password safely.</p>
          </div>

          <Input
            label="Admin Full Name"
            placeholder="Owner name"
            value={payload.admin.name}
            onChange={e => setPayload({ ...payload, admin: { ...payload.admin, name: e.target.value } })}
          />
          <Input
            label="Admin Username*"
            placeholder="e.g. owner"
            value={payload.admin.username}
            onChange={e => setPayload({ ...payload, admin: { ...payload.admin, username: e.target.value } })}
          />
          <Input
            label="Admin Password*"
            type="password"
            placeholder="Min 8 characters"
            value={payload.admin.password}
            onChange={e => setPayload({ ...payload, admin: { ...payload.admin, password: e.target.value } })}
          />
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Staff Accounts (Optional)</h2>
            <p className="text-xs text-white/50">Add sales consultants or skip to finish setup.</p>
          </div>

          <div className="flex flex-col gap-2">
            {payload.staff.map((s, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  placeholder="Staff Name"
                  value={s.name}
                  onChange={e => {
                    const newStaff = [...payload.staff];
                    newStaff[idx].name = e.target.value;
                    setPayload({ ...payload, staff: newStaff });
                  }}
                  className="bg-black/30 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white flex-1"
                />
                <button
                  onClick={() => setPayload({ ...payload, staff: payload.staff.filter((_, i) => i !== idx) })}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setPayload({ ...payload, staff: [...payload.staff, { name: '', username: 'staff' + (payload.staff.length + 1), password: 'password123' }] })}
              className="mt-2 text-xs text-[#e8cf7a] hover:underline flex items-center gap-1 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add staff member
            </button>
          </div>
        </div>
      )}

      {errorMsg && <div className="text-xs text-red-400 mt-3">{errorMsg}</div>}

      <div className="flex justify-between items-center mt-8 pt-4 border-t border-white/10">
        {step > 1 ? (
          <Button variant="ghost" onClick={handleBack} size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        ) : <div />}

        <Button onClick={handleNext} size="sm">
          {step === totalSteps ? 'Finish setup' : 'Next'} <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
