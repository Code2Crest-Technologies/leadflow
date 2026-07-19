'use client';

import { useState } from 'react';
import type { FormFieldType, LeadFlowFormField } from '@/types';
import type { FieldPayload } from '@/services/formsService';
import { TrashIcon } from '@/components/ui/Icons';

const fieldTypes: FormFieldType[] = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'NUMBER',
  'URL',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'RADIO',
  'CHECKBOX',
  'BOOLEAN',
];

const blankField: FieldPayload = {
  key: '',
  label: '',
  type: 'TEXT',
  placeholder: '',
  helpText: '',
  required: false,
  order: 0,
  options: [],
  validation: {},
};

function parseOptions(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.includes('|') ? line.split('|').map((part) => part.trim()) : [line, line];
      return { value, label: label || value };
    });
}

function optionsText(field: LeadFlowFormField | FieldPayload) {
  return (field.options || []).map((option) => `${option.value}|${option.label}`).join('\n');
}

export function FormBuilder({
  fields,
  saving,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}: {
  fields: LeadFlowFormField[];
  saving: boolean;
  onAdd: (payload: FieldPayload) => Promise<void>;
  onUpdate: (fieldId: string, payload: FieldPayload) => Promise<void>;
  onDelete: (fieldId: string) => Promise<void>;
  onMove: (fieldIds: string[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FieldPayload>(blankField);
  const [editingId, setEditingId] = useState('');
  const [optionDraft, setOptionDraft] = useState('');

  const editingField = fields.find((field) => field.id === editingId);
  const needsOptions = ['SELECT', 'MULTISELECT', 'RADIO'].includes(draft.type);

  function startEdit(field: LeadFlowFormField) {
    setEditingId(field.id || '');
    setDraft({
      key: field.key,
      label: field.label,
      type: field.type,
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      required: field.required,
      order: field.order,
      options: field.options || [],
      validation: field.validation || {},
    });
    setOptionDraft(optionsText(field));
  }

  function reset() {
    setEditingId('');
    setDraft(blankField);
    setOptionDraft('');
  }

  async function saveField() {
    const payload = { ...draft, options: needsOptions ? parseOptions(optionDraft) : undefined };
    if (editingId) await onUpdate(editingId, payload);
    else await onAdd({ ...payload, order: fields.length });
    reset();
  }

  async function move(fieldId: string | undefined, direction: -1 | 1) {
    if (!fieldId) return;
    const index = fields.findIndex((field) => field.id === fieldId);
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const ids = fields.map((field) => field.id!).filter(Boolean);
    const [item] = ids.splice(index, 1);
    ids.splice(target, 0, item);
    await onMove(ids);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--color-border)] p-5">
          <h2 className="text-xl font-bold">Fields</h2>
          <p className="text-sm text-[var(--color-muted)]">Use numeric ordering or the up/down controls. Drag-and-drop can come later.</p>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {fields.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-muted)]">No fields yet.</div>
          ) : (
            fields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-[var(--color-text)]">{field.label}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {field.key} · {field.type} · {field.required ? 'Required' : 'Optional'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary h-9 px-3" onClick={() => move(field.id, -1)} disabled={saving || index === 0}>Up</button>
                  <button type="button" className="btn-secondary h-9 px-3" onClick={() => move(field.id, 1)} disabled={saving || index === fields.length - 1}>Down</button>
                  <button type="button" className="btn-secondary h-9 px-3" onClick={() => startEdit(field)} disabled={saving}>Edit</button>
                  <button type="button" className="btn-secondary h-9 px-3 text-red-600" onClick={() => field.id && onDelete(field.id)} disabled={saving}>
                    <TrashIcon className="h-4 w-4" />Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">{editingField ? 'Edit field' : 'Add field'}</h2>
        <div className="mt-5 space-y-3">
          <input className="input-field" placeholder="Label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
          <input className="input-field" placeholder="key_name" value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value })} />
          <select className="input-field" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as FormFieldType })}>
            {fieldTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
          <input className="input-field" placeholder="Placeholder" value={draft.placeholder} onChange={(event) => setDraft({ ...draft, placeholder: event.target.value })} />
          <input className="input-field" placeholder="Help text" value={draft.helpText} onChange={(event) => setDraft({ ...draft, helpText: event.target.value })} />
          {needsOptions && (
            <textarea
              className="input-field min-h-28"
              placeholder={'Option value|Option label\nanother|Another option'}
              value={optionDraft}
              onChange={(event) => setOptionDraft(event.target.value)}
            />
          )}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={draft.required} onChange={(event) => setDraft({ ...draft, required: event.target.checked })} />
            Required field
          </label>
          <div className="flex justify-end gap-2">
            {editingId && <button type="button" className="btn-secondary" onClick={reset} disabled={saving}>Cancel</button>}
            <button type="button" className="btn-primary" onClick={saveField} disabled={saving || !draft.key || !draft.label}>
              {saving ? 'Saving...' : editingId ? 'Update field' : 'Add field'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
