import React, { useState } from 'react';
import SetupWizard from './components/SetupWizard';
import DashboardApp from './components/DashboardApp';
import { SetupPayload } from './types';

export default function App() {
  const [isSetupComplete, setIsSetupComplete] = useState(() => {
    return localStorage.getItem('royal_bath_hub_setup_done') === 'true';
  });

  const handleSetupComplete = (payload: SetupPayload) => {
    localStorage.setItem('royal_bath_hub_setup_done', 'true');
    localStorage.setItem('royal_bath_hub_branding', JSON.stringify(payload));
  };

  const handleDone = () => {
    setIsSetupComplete(true);
  };

  if (!isSetupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062e21] to-[#0a4531] font-sans flex flex-col items-center justify-center p-4 relative">
        {/* Bypass link for instant demo inspection */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setIsSetupComplete(true)}
            className="text-xs text-[#e8cf7a]/70 hover:text-[#e8cf7a] underline bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg"
          >
            Skip to Dashboard →
          </button>
        </div>

        <SetupWizard onComplete={handleSetupComplete} onDone={handleDone} />
      </div>
    );
  }

  return <DashboardApp />;
}
