import { z } from 'zod';

import { isApiError } from '../../shared/api/errors';
import {
  PutEmergencyContactBody,
  putEmergencyContactBodyPhoneRegExp,
} from '../../shared/api/generated/zod/me/me.zod';

/** Custom gear item length (spec: each ≤30 characters). */
export const CUSTOM_GEAR_ITEM_MAX = 30;
export const MAX_PEOPLE_DEFAULT = 10;
export const CARPOOL_SEATS_DEFAULT = 3;
export const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Uzbekistan only: a fixed prefix, the field holds the 9 national digits. */
export const PHONE_PREFIX = '+998';
const PHONE_DIGITS = 9;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatPhoneInput(raw: string): string {
  const digits = digitsOnly(raw).slice(0, PHONE_DIGITS);
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return groups.filter(Boolean).join(' ');
}

/** Emergency contact form over the generated body schema; messages are i18n keys. */
export const ContactFormSchema = z.object({
  name: z.string().trim().min(1, 'auth.errors.required').pipe(PutEmergencyContactBody.shape.name),
  relation: z.string().trim().min(1, 'auth.errors.required').pipe(PutEmergencyContactBody.shape.relation),
  phone: z
    .string()
    .transform(value => `${PHONE_PREFIX}${digitsOnly(value)}`)
    .pipe(z.string().regex(putEmergencyContactBodyPhoneRegExp, 'tripEvents.contact.phoneInvalid')),
});

export type ContactForm = z.output<typeof ContactFormSchema>;

/** Form sections that a 422 GROUP_TRIP_INVALID field can point at. */
export type FormSection = 'times' | 'meeting' | 'carpool' | 'maxPeople' | 'minLevel' | 'gear' | 'description' | 'groups';

const sectionOf: Record<string, FormSection> = {
  startAt: 'times',
  backBy: 'times',
  meetingText: 'meeting',
  meeting: 'meeting',
  meetingLat: 'meeting',
  meetingLng: 'meeting',
  carpool: 'carpool',
  carpoolFrom: 'carpool',
  carpoolSeats: 'carpool',
  maxPeople: 'maxPeople',
  minLevel: 'minLevel',
  gearKeys: 'gear',
  customGear: 'gear',
  description: 'description',
  groupIds: 'groups',
};

/** 422 GROUP_TRIP_INVALID → the form sections to mark (unknown fields fall back to a toast). */
export function sectionErrors(error: unknown): Partial<Record<FormSection, true>> | null {
  if (!isApiError(error) || error.code !== 'GROUP_TRIP_INVALID' || !error.fieldErrors) {
    return null;
  }
  const marked: Partial<Record<FormSection, true>> = {};
  for (const field of Object.keys(error.fieldErrors)) {
    const section = sectionOf[field];
    if (section) {
      marked[section] = true;
    }
  }
  return Object.keys(marked).length > 0 ? marked : null;
}
