/*
 * React Native test environment plus CanvasKit, so Skia's official Jest double
 * (@shopify/react-native-skia/jestSetup.js) draws with real paths. Same setup as Skia's jestEnv.js,
 * on top of the React Native preset environment instead of plain Node.
 */
const ReactNativeEnv = require('@react-native/jest-preset/jest/react-native-env.js');
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit');

module.exports = class SkiaReactNativeEnv extends ReactNativeEnv {
  async setup() {
    await super.setup();
    this.global.CanvasKit = await CanvasKitInit({});
  }
};
