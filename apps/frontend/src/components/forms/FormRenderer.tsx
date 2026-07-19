'use client';

import type { LeadFlowFormField } from '@/types';

interface FormRendererProps {
  fields: LeadFlowFormField[];
  values: Record<string, unknown>;
  errors?: Record<string, string>;
  preview?: boolean;
  disabled?: boolean;
  onChange: (key: string, value: unknown) => void;
}

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function FormRenderer({ fields, values, errors = {}, preview = false, disabled = false, onChange }: FormRendererProps) {
  if (fields.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center text-[var(--color-muted)]">
        No fields yet. Add fields to preview this form.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const error = errors[field.key];
        const commonLabel = (
          <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
            {field.label}
            {field.required && <span className="text-red-600"> *</span>}
          </span>
        );

        return (
          <label key={field.id || field.key} className="block">
            {commonLabel}
            {field.type === 'TEXTAREA' ? (
              <textarea
                className="input-field min-h-28"
                placeholder={field.placeholder || ''}
                value={stringValue(values[field.key])}
                disabled={disabled || preview}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : ['SELECT', 'RADIO'].includes(field.type) ? (
              <select
                className="input-field"
                value={stringValue(values[field.key])}
                disabled={disabled || preview}
                onChange={(event) => onChange(field.key, event.target.value)}
              >
                <option value="">Choose an option</option>
                {(field.options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'MULTISELECT' ? (
              <select
                className="input-field min-h-28"
                multiple
                value={Array.isArray(values[field.key]) ? (values[field.key] as string[]) : []}
                disabled={disabled || preview}
                onChange={(event) => onChange(field.key, Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
              >
                {(field.options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : ['CHECKBOX', 'BOOLEAN'].includes(field.type) ? (
              <span className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={Boolean(values[field.key])}
                  disabled={disabled || preview}
                  onChange={(event) => onChange(field.key, event.target.checked)}
                />
                <span className="text-sm text-[var(--color-muted)]">{field.placeholder || 'Yes'}</span>
              </span>
            ) : (
              <input
                className="input-field"
                type={field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : field.type === 'NUMBER' ? 'number' : field.type === 'URL' ? 'url' : field.type === 'DATE' ? 'date' : 'text'}
                placeholder={field.placeholder || ''}
                value={stringValue(values[field.key])}
                disabled={disabled || preview}
                onChange={(event) => onChange(field.key, field.type === 'NUMBER' ? Number(event.target.value) : event.target.value)}
              />
            )}
            {field.helpText && <span className="mt-1 block text-xs text-[var(--color-muted)]">{field.helpText}</span>}
            {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
          </label>
        );
      })}
    </div>
  );
}
