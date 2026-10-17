import { defineConfig } from 'orval';

/**
 * API codegen (ADR-003): react-query hooks over the shared axios mutator, plus zod schemas.
 * Output is never edited by hand; run `npm run gen:api` after every contract change.
 */
export default defineConfig({
  irbis: {
    input: { target: '../irbis-api/openapi.json' },
    output: {
      mode: 'tags-split',
      target: 'src/shared/api/generated/endpoints.ts',
      schemas: 'src/shared/api/generated/model',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      override: {
        mutator: { path: 'src/shared/api/client.ts', name: 'apiClient' },
        query: { signal: true },
      },
    },
  },
  irbisZod: {
    input: { target: '../irbis-api/openapi.json' },
    output: {
      mode: 'tags-split',
      target: 'src/shared/api/generated/zod',
      client: 'zod',
      fileExtension: '.zod.ts',
    },
  },
});
