import React, { useEffect, useRef, useState } from 'react';
import { THEME_REGISTRY } from '../themes';

export default function ThemePreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const themeControlRef = useRef<{ dispose: () => void; resize: () => void } | null>(null);
  
  const [activeTheme, setActiveTheme] = useState('nature');

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clean up previous theme
    if (themeControlRef.current) {
      themeControlRef.current.dispose();
      themeControlRef.current = null;
    }

    const themeDef = THEME_REGISTRY.find(t => t.id === activeTheme);
    if (!themeDef) return;

    if ('external' in themeDef && themeDef.external) {
      // Simulate external theme behavior
      containerRef.current.style.backgroundColor = '#062e21';
      containerRef.current.innerHTML = `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.2); font-weight: bold; font-size: 2rem;">[External Theme: ${themeDef.label}]</div>`;
      return;
    }

    if ('mount' in themeDef && themeDef.mount) {
      themeControlRef.current = themeDef.mount(containerRef.current);
    }

    const handleResize = () => {
      if (themeControlRef.current?.resize) {
        themeControlRef.current.resize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (themeControlRef.current) {
        themeControlRef.current.dispose();
        themeControlRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.style.cssText = '';
        delete containerRef.current.dataset.mode;
      }
    };
  }, [activeTheme]);

  return (
    <div className="fixed inset-0 flex flex-col font-sans overflow-hidden">
      {/* Background layer container */}
      <div ref={containerRef} className="absolute inset-0 -z-10" />
      
      {/* UI Overlay */}
      <div className="flex-1 p-8 flex flex-col items-center justify-center pointer-events-none">
        
        {/* Sample Glass Card */}
        <div className="bg-[#0a140e]/72 border border-white/10 rounded-[14px] p-8 max-w-sm w-full backdrop-blur-md shadow-2xl pointer-events-auto transition-colors duration-500 light-mode:bg-white/80 light-mode:border-black/10 light-mode:text-black">
          <style>{`
            /* Global styling hook for light mode panels */
            div[data-mode="light"] ~ div .light-mode\\:bg-white\\/80 { background-color: rgba(255,255,255,0.8); }
            div[data-mode="light"] ~ div .light-mode\\:border-black\\/10 { border-color: rgba(0,0,0,0.1); }
            div[data-mode="light"] ~ div .light-mode\\:text-black { color: #111; }
            div[data-mode="light"] ~ div h3 { color: #333 !important; }
            div[data-mode="light"] ~ div .text-white\\/50 { color: rgba(0,0,0,0.5) !important; }
          `}</style>

          <h3 className="text-xs font-semibold text-white/50 tracking-wider uppercase mb-4">Demo Hardware Store</h3>
          <div className="text-3xl font-light mb-1 tracking-tight text-emerald-400">
            $ 2,140
          </div>
          <div className="text-[11px] text-white/40 mb-8">
            Net Profit
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60">Select Theme</label>
            <select 
              value={activeTheme} 
              onChange={e => setActiveTheme(e.target.value)}
              className="w-full bg-black/25 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]/75 appearance-none cursor-pointer"
            >
              {THEME_REGISTRY.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

      </div>
    </div>
  );
}
