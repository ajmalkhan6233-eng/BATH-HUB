import { useState } from 'react';
import SetupWizard from './components/SetupWizard';
import DashboardApp from './components/DashboardApp';

export default function App() {
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  if (isSetupComplete) {
    return <DashboardApp />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#062e21] to-[#0a4531] font-sans flex items-center justify-center p-4">
      <SetupWizard 
        onComplete={(payload) => console.log('Wizard complete!', payload)}
        onDone={() => setIsSetupComplete(true)}
      />
    </div>
  );
}
