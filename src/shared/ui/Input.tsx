import React from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, mono, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <div className={`field ${error ? 'field--error' : ''} ${className}`}>
        <label className="field__label" htmlFor={inputId}>
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`field__input ${mono ? 'amount' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {hint && !error && (
          <span className="field__hint" id={`${inputId}-hint`}>{hint}</span>
        )}
        {error && (
          <span className="field__error" id={`${inputId}-error`} role="alert">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
