/** Raster assets resolve to a Metro asset id (React Native `require` for images). */
declare module '*.png' {
  const source: import('react-native').ImageRequireSource;
  export default source;
}

declare module '*.jpg' {
  const source: import('react-native').ImageRequireSource;
  export default source;
}
