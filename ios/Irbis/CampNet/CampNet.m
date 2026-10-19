#import <React/RCTBridgeModule.h>

// Exposes the Swift `CampNet` class to React Native under the same JS name as Android's module.
@interface RCT_EXTERN_MODULE(CampNet, NSObject)

RCT_EXTERN_METHOD(startHotspot:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopHotspot:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getWifiIp:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getHotspotIp:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
