import { z } from 'zod';

import {
  PutEmergencyContactBody,
  putEmergencyContactBodyPhoneRegExp,
} from '../../shared/api/generated/zod/me/me.zod';

/** Uzbekistan only (spec Q8): a fixed prefix, the field holds the 9 national digits. */
export const PHONE_PREFIX = '+998';
const PHONE_DIGITS = 9;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** "+998901234567" for the API from "90 123 45 67". */
export function toApiPhone(value: string): string {
  return `${PHONE_PREFIX}${digitsOnly(value)}`;
}

/** "901234567" → "90 123 45 67" while typing; never more than 9 digits. */
export function formatPhoneInput(raw: string): string {
  const digits = digitsOnly(raw).slice(0, PHONE_DIGITS);
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return groups.filter(Boolean).join(' ');
}

/** Contact form (AC4) over the generated body schema; messages are i18n keys. */
export const ContactFormSchema = z.object({
  name: z.string().trim().min(1, 'auth.errors.required').pipe(PutEmergencyContactBody.shape.name),
  relation: z.string().trim().min(1, 'auth.errors.required').pipe(PutEmergencyContactBody.shape.relation),
  phone: z
    .string()
    .transform(toApiPhone)
    .pipe(z.string().regex(putEmergencyContactBodyPhoneRegExp, 'trip.contactPhoneInvalid')),
});

export type ContactFormInput = z.input<typeof ContactFormSchema>;
export type ContactForm = z.output<typeof ContactFormSchema>;
