import React from 'react';

interface InputProps {
  label: string;
  error?: string;
  className?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  [key: string]: any;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-white/60">{label}</label>
      <input
        className={`w-full bg-black/25 border rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-[#d4af37]/75 focus:ring-1 focus:ring-[#d4af37]/75 transition-colors ${
          error ? 'border-red-400/50' : 'border-white/15'
        }`}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
