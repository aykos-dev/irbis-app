const esmPackages = [
  'react-native',
  '@react-native',
  '@react-native-community',
  '@react-navigation',
  'react-native-.*',
  '@gorhom',
  'i18n-js',
].join('|');

module.exports = {
  preset: '@react-native/jest-preset',
  // Node crawler: the Homebrew watchman on the dev Mac is broken and not needed for tests.
  watchman: false,
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Sound clips resolve like images (the preset's asset transformer lists no audio types).
  transform: {
    '^.+\\.m4a$': require.resolve('@react-native/jest-preset/jest/assetFileTransformer.js'),
  },
  transformIgnorePatterns: [`node_modules/(?!(${esmPackages})/)`],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/harness\\.tsx$'],
};
