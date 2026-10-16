import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
  
  const sizeStyles = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5'
  };

  const variantStyles = {
    primary: 'bg-[#d4af37] text-[#062e21] font-semibold hover:bg-[#ebd075] focus:ring-[#d4af37]/50 shadow-md',
    ghost: 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border border-white/10',
    outline: 'bg-transparent text-[#e8cf7a] border border-[#d4af37]/50 hover:bg-[#d4af37]/10',
    danger: 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
