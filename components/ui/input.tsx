'use client';

import { forwardRef } from 'react';

type InputProps = {
  label?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, placeholder, type = 'text', disabled, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col">
        {label && (
          <label className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          className={`bg-surface-low px-4 py-3 rounded-xl border border-border/20 focus:outline-none focus:ring-2 focus:ring-ring text-sm placeholder:text-muted-foreground/50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? 'border-status-error/50' : ''
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="text-xs text-status-error mt-1.5">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
