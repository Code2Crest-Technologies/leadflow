import type { FormField, Prisma } from '@prisma/client';

type JsonRecord = Record<string, unknown>;

export type SubmissionValueMap = Record<string, unknown>;

export class FormSubmissionValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Form submission validation failed');
  }
}

function asRecord(value: Prisma.JsonValue | null | undefined): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function getOptionValues(field: FormField) {
  const options = field.options;
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => {
      if (typeof option === 'string') return option;
      if (option && typeof option === 'object' && !Array.isArray(option)) {
        const value = (option as JsonRecord).value;
        return typeof value === 'string' ? value : null;
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
}

function requiredMissing(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function validateText(value: unknown, validation: JsonRecord, multiline = false) {
  if (typeof value !== 'string') return 'Enter text.';
  const max = Number(validation.maxLength ?? (multiline ? 4000 : 500));
  const min = Number(validation.minLength ?? 0);
  if (value.length < min) return `Enter at least ${min} characters.`;
  if (value.length > max) return `Keep this under ${max} characters.`;
  return null;
}

function validateFieldValue(field: FormField, value: unknown) {
  if (requiredMissing(value)) {
    return field.required ? 'This field is required.' : null;
  }

  const validation = asRecord(field.validation);
  const options = getOptionValues(field);

  switch (field.type) {
    case 'TEXT':
      return validateText(value, validation);
    case 'TEXTAREA':
      return validateText(value, validation, true);
    case 'EMAIL':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Enter a valid email.';
    case 'PHONE':
      return typeof value === 'string' && /^[+\d\s().-]{7,30}$/.test(value) ? null : 'Enter a valid phone number.';
    case 'NUMBER': {
      const number = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(number)) return 'Enter a valid number.';
      const min = validation.min !== undefined ? Number(validation.min) : null;
      const max = validation.max !== undefined ? Number(validation.max) : null;
      if (min !== null && number < min) return `Enter at least ${min}.`;
      if (max !== null && number > max) return `Enter no more than ${max}.`;
      return null;
    }
    case 'URL':
      try {
        if (typeof value !== 'string') return 'Enter a valid URL.';
        new URL(value);
        return null;
      } catch {
        return 'Enter a valid URL.';
      }
    case 'DATE':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? null : 'Enter a valid date.';
    case 'SELECT':
    case 'RADIO':
      return typeof value === 'string' && options.includes(value) ? null : 'Choose a valid option.';
    case 'MULTISELECT':
      return Array.isArray(value) && value.every((item) => typeof item === 'string' && options.includes(item))
        ? null
        : 'Choose valid options.';
    case 'CHECKBOX':
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : 'Choose true or false.';
    default:
      return 'Unsupported field type.';
  }
}

export function validateSubmissionValues(fields: FormField[], values: SubmissionValueMap) {
  const allowedKeys = new Set(fields.map((field) => field.key));
  const fieldErrors: Record<string, string> = {};

  Object.keys(values).forEach((key) => {
    if (!allowedKeys.has(key)) {
      fieldErrors[key] = 'Unknown field.';
    }
  });

  fields.forEach((field) => {
    const error = validateFieldValue(field, values[field.key]);
    if (error) fieldErrors[field.key] = error;
  });

  if (Object.keys(fieldErrors).length > 0) {
    throw new FormSubmissionValidationError(fieldErrors);
  }
}

export function getSubmittedBy(
  fields: FormField[],
  values: SubmissionValueMap,
): { submittedByEmail: string | null; submittedByName: string | null } {
  const emailField = fields.find((field) => field.type === 'EMAIL');
  const nameField = fields.find((field) => ['name', 'fullName', 'full_name'].includes(field.key));
  const emailValue = emailField ? values[emailField.key] : null;
  const nameValue = nameField ? values[nameField.key] : null;

  return {
    submittedByEmail: typeof emailValue === 'string' ? emailValue : null,
    submittedByName: typeof nameValue === 'string' ? nameValue : null,
  };
}
