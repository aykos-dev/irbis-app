import { z } from 'zod';

import {
  AuthForgotPasswordBody,
  AuthLogInBody,
  AuthResetPasswordBody,
  AuthSignUpBody,
} from '../../shared/api/generated/zod/auth/auth.zod';
import {
  MeSetRecoveryPhoneBody,
  MeVerifyRecoveryPhoneBody,
} from '../../shared/api/generated/zod/me/me.zod';

/**
 * Form schemas: the generated request schemas, tightened with the UI rules of the auth spec
 * (AC3, AC5). Messages are i18n keys; the form translates them where it renders them.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;
export const PHONE_DIGITS = 9;
export const CODE_DIGITS = 6;
/** Uzbekistan country code, shown as a fixed prefix; the field holds the 9 national digits. */
export const PHONE_PREFIX = '+998';

export const usernameSchema = AuthSignUpBody.shape.username
  .min(USERNAME_MIN, 'auth.errors.usernameLength')
  .max(USERNAME_MAX, 'auth.errors.usernameLength')
  .regex(/^[a-z0-9._]+$/i, 'auth.errors.usernameChars')
  .refine(value => !value.startsWith('.') && !value.endsWith('.'), 'auth.errors.usernameDot');

const passwordSchema = AuthSignUpBody.shape.password
  .min(PASSWORD_MIN, 'auth.errors.passwordLength')
  .max(PASSWORD_MAX, 'auth.errors.passwordLength');

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Optional recovery phone: empty, or exactly 9 national digits. */
const optionalPhoneSchema = z
  .string()
  .refine(
    value => digitsOnly(value) === '' || digitsOnly(value).length === PHONE_DIGITS,
    'auth.errors.phoneInvalid',
  );

const requiredPhoneSchema = z
  .string()
  .refine(value => digitsOnly(value).length === PHONE_DIGITS, 'auth.errors.phoneInvalid');

const codeSchema = z.string().regex(new RegExp(`^\\d{${CODE_DIGITS}}$`), 'auth.errors.codeLength');

export const SignUpFormSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    phone: optionalPhoneSchema,
    acceptTerms: AuthSignUpBody.shape.acceptTerms.refine(
      accepted => accepted,
      'auth.errors.termsRequired',
    ),
  })
  .refine(form => form.password.toLowerCase() !== form.username.toLowerCase(), {
    path: ['password'],
    message: 'auth.errors.passwordSameAsUsername',
  });
export type SignUpForm = z.infer<typeof SignUpFormSchema>;

export const LogInFormSchema = z.object({
  username: AuthLogInBody.shape.username.min(1, 'auth.errors.required'),
  password: AuthLogInBody.shape.password.min(1, 'auth.errors.required'),
});
export type LogInForm = z.infer<typeof LogInFormSchema>;

export const ForgotFormSchema = z.object({
  username: AuthForgotPasswordBody.shape.username.min(1, 'auth.errors.required'),
});
export type ForgotForm = z.infer<typeof ForgotFormSchema>;

export const ResetFormSchema = z
  .object({
    code: AuthResetPasswordBody.shape.code.pipe(codeSchema),
    newPassword: AuthResetPasswordBody.shape.newPassword
      .min(PASSWORD_MIN, 'auth.errors.passwordLength')
      .max(PASSWORD_MAX, 'auth.errors.passwordLength'),
  });
export type ResetForm = z.infer<typeof ResetFormSchema>;

export const PhoneFormSchema = z.object({
  phone: MeSetRecoveryPhoneBody.shape.phone.pipe(requiredPhoneSchema),
});
export type PhoneForm = z.infer<typeof PhoneFormSchema>;

export const VerifyFormSchema = z.object({
  code: MeVerifyRecoveryPhoneBody.shape.code.pipe(codeSchema),
});
export type VerifyForm = z.infer<typeof VerifyFormSchema>;

/** "90 123 45 67" → "+998901234567" for the API. */
export function toApiPhone(value: string): string {
  return `${PHONE_PREFIX}${digitsOnly(value)}`;
}
