import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';

/** Single-owner wrappers (docs/architecture.md, Directory Structure rules). */
const singleOwner = [
  { name: 'axios', owner: 'src/shared/api/client.ts' },
  { name: 'react-native-keychain', owner: 'src/shared/api/tokenManager.ts' },
  { name: 'react-native-mmkv', owner: 'src/shared/storage/**' },
  { name: 'react-native-haptic-feedback', owner: 'src/shared/utils/haptics.ts' },
];

const restrictedImports = [
  ...singleOwner.map(({ name, owner }) => ({
    name,
    message: `Only ${owner} may import ${name}.`,
  })),
  {
    name: 'react-native',
    importNames: ['TouchableOpacity', 'TouchableHighlight', 'Animated'],
    message: 'Use shared Pressable and Reanimated (engineering-standards §1).',
  },
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'android/',
      'ios/',
      'coverage/',
      'src/shared/api/generated/',
      '*.config.js',
      'jest.setup.js',
      '.prettierrc.js',
      'index.js',
      'react-native.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, __DEV__: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', { paths: restrictedImports }],
    },
  },
  ...singleOwner.map(({ name, owner }) => ({
    files: [owner],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: restrictedImports.filter(p => p.name !== name) },
      ],
    },
  })),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js', '.json'] },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        {
          type: 'feature',
          pattern: 'src/features/*',
          capture: ['featureName'],
        },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'assets', pattern: 'src/assets' },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: {
                to: { element: { type: ['app', 'feature', 'shared', 'assets'] } },
              },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: [
                  {
                    element: {
                      type: 'feature',
                      captured: { featureName: '{{from.element.captured.featureName}}' },
                    },
                  },
                  { element: { type: ['shared', 'assets'] } },
                ],
              },
            },
            {
              // Screen props: features may import app/navigation types, never app values.
              from: { element: { type: 'feature' } },
              allow: { to: { element: { type: 'app' } }, dependency: { kind: 'type' } },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: ['shared', 'assets'] } } },
            },
          ],
        },
      ],
    },
  },
  {
    // Tests talk to libraries at the boundary (axios adapter, haptics spy, module isolation).
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'jest/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },  {
    // Node dev tooling (CommonJS), not bundled into the app.
    files: ['scripts/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
