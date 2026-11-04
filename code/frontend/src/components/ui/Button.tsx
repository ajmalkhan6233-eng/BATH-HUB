import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'ghost';
  className?: string;
  children?: React.ReactNode;
  [key: string]: any; // Catch-all for other button attributes
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const baseClass = "px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-[#d4af37] text-[#062e21] hover:bg-[#ebd075]",
    ghost: "bg-white/10 text-white hover:bg-white/20 border border-white/10"
  };
  
  return (
    <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
