'use client';

import { Check, X } from 'lucide-react';

interface PasswordChecklistProps {
  password: string;
}

export function validatePasswordRules(password: string) {
  return {
    hasMinLength: password.length >= 9,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const rules = validatePasswordRules(password);

  const items = [
    { label: 'More than 8 characters (at least 9)', valid: rules.hasMinLength },
    { label: 'At least one uppercase letter (A-Z)', valid: rules.hasUppercase },
    { label: 'At least one lowercase letter (a-z)', valid: rules.hasLowercase },
    { label: 'At least one special character (e.g. !@#$%)', valid: rules.hasSpecial },
  ];

  return (
    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
      <p className="font-semibold text-slate-400 mb-1">Password requirements:</p>
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-center gap-2 transition-colors ${
            item.valid ? 'text-emerald-400 font-medium' : 'text-slate-500'
          }`}
        >
          {item.valid ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

