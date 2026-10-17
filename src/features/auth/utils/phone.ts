import { PHONE_DIGITS, digitsOnly } from '../schemas';

/** "901234567" → "90 123 45 67" while typing; never more than 9 digits. */
export function formatPhoneInput(raw: string): string {
  const digits = digitsOnly(raw).slice(0, PHONE_DIGITS);
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return groups.filter(Boolean).join(' ');
}
