import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * react-hook-form resolver for zod 4 schemas (engineering-standards §9: forms validate with the
 * generated schemas, extended locally). Issue messages are i18n keys, translated where rendered.
 * First issue per field wins; nested paths are joined with dots.
 */
export function zodResolver<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
): Resolver<z.infer<S>> {
  return async values => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.');
      if (field && !(field in errors)) {
        errors[field] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors: errors as FieldErrors<z.infer<S>> };
  };
}
