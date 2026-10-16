import { appConfig } from '../constants/config';

/**
 * The only QA logger (engineering-standards §16). In dev and staging builds it prints one
 * `IRBIS_QA {json}` line per event for the adb QA toolkit; in production it does nothing.
 *
 * Props are names, ids, counts, booleans, metres and enum states only — never tokens, phone
 * numbers, names, precise coordinates or free text the user typed.
 */
export type QaProps = Record<string, string | number | boolean | null>;

export const QA_LOG_PREFIX = 'IRBIS_QA';

export function qaLog(event: string, props: QaProps = {}): void {
  if (!appConfig.isQaEnabled) {
    return;
  }
  console.log(`${QA_LOG_PREFIX} ${JSON.stringify({ event, ...props })}`);
}
