import Config from 'react-native-config';
import { z } from 'zod';

/**
 * Typed read of react-native-config. Public build-time values only (API base URL, environment);
 * filled per flavour from `.env.dev` / `.env.staging` / `.env.prod` (names in `.env.example`).
 */
const configSchema = z.object({
  API_URL: z.url(),
  APP_ENV: z.enum(['dev', 'staging', 'prod']),
});

export type AppEnv = z.infer<typeof configSchema>['APP_ENV'];

const parsed = configSchema.safeParse(Config);

if (!parsed.success) {
  throw new Error(
    `Invalid build config (.env.<flavour>): ${parsed.error.issues
      .map(issue => issue.path.join('.'))
      .join(', ')}`,
  );
}

export const appConfig = {
  apiUrl: parsed.data.API_URL,
  appEnv: parsed.data.APP_ENV,
  /** QA events and dev tools exist only outside production. */
  isQaEnabled: parsed.data.APP_ENV !== 'prod',
} as const;
