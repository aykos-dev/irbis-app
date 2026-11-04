const esmPackages = [
  'react-native',
  '@react-native',
  '@react-native-community',
  '@react-navigation',
  'react-native-.*',
  '@gorhom',
  'd3-.*',
  'internmap',
  'i18n-js',
].join('|');

module.exports = {
  preset: '@react-native/jest-preset',
  // Node crawler: the Homebrew watchman on the dev Mac is broken and not needed for tests.
  watchman: false,
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Sound clips resolve like images (the preset's asset transformer lists no audio types).
  // d3-geo / d3-array ship only ESM `.mjs`, which the preset's babel transform does not match.
  transform: {
    '^.+\\.mjs$': 'babel-jest',
    '^.+\\.m4a$': require.resolve('@react-native/jest-preset/jest/assetFileTransformer.js'),
  },
  transformIgnorePatterns: [`node_modules/(?!(${esmPackages})/)`],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/harness\\.tsx$'],
};
