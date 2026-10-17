import Config from 'react-native-config';
import { z } from 'zod';

/**
 * Typed read of react-native-config. Public build-time values only (API base URL, environment);
 * filled per flavour from `.env.dev` / `.env.staging` / `.env.prod` (names in `.env.example`).
 */
const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const configSchema = z.object({
  API_URL: z.url(),
  APP_ENV: z.enum(['dev', 'staging', 'prod']),
  /** MapLibre style for Explore; documented default in `.env.example`. */
  MAP_STYLE_URL: z.url().default(DEFAULT_MAP_STYLE_URL),
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
  mapStyleUrl: parsed.data.MAP_STYLE_URL,
  /** QA events and dev tools exist only outside production. */
  isQaEnabled: parsed.data.APP_ENV !== 'prod',
} as const;
