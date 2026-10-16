import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-white/70">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full bg-black/30 border border-white/15 rounded-lg px-3.5 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-colors ${
          error ? 'border-red-500/70' : ''
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
      {helperText && !error && <span className="text-xs text-white/40">{helperText}</span>}
    </div>
  );
};
