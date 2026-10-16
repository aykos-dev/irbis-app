module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // zod 4 ships `export * as ns`, which the RN preset does not transform.
    '@babel/plugin-transform-export-namespace-from',
    // Must be last: Reanimated 4 worklets.
    'react-native-worklets/plugin',
  ],
};
