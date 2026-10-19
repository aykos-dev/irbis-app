#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>

// Exposes the Swift `CampNet` class to React Native under the same JS name as Android's module.
@interface RCT_EXTERN_MODULE(CampNet, NSObject)

RCT_EXTERN_METHOD(startHotspot:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopHotspot:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getWifiIp:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getHotspotIp:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(isCaptured:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end

// `campCaptureChanged { captured }` when screen recording or mirroring starts or stops
// (campfire-party AC3). An Objective-C emitter, so the Swift module needs no React headers.
@interface CampCapture : RCTEventEmitter
@end

@implementation CampCapture

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"campCaptureChanged" ];
}

- (void)startObserving
{
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(capturedDidChange)
                                               name:UIScreenCapturedDidChangeNotification
                                             object:nil];
}

- (void)stopObserving
{
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIScreenCapturedDidChangeNotification
                                                object:nil];
}

- (void)capturedDidChange
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self sendEventWithName:@"campCaptureChanged"
                       body:@{ @"captured" : @(UIScreen.mainScreen.isCaptured) }];
  });
}

@end
