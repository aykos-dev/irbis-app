import Darwin
import Foundation

/// iOS side of the `CampNet` native module (Campfire, AC4). iOS has no API to start a hotspot,
/// so the host turns on Personal Hotspot in Settings and the app only reads the phone's
/// addresses: `bridge100` is Personal Hotspot, `en0` is Wi-Fi. Each getter resolves
/// `{ ip, iface }` or null. Blocks are plain closures so no bridging header is needed.
@objc(CampNet)
final class CampNet: NSObject {
  private static let hotspotIface = "bridge100"
  private static let wifiIface = "en0"

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(startHotspot:reject:)
  func startHotspot(
    _ resolve: @escaping (Any?) -> Void,
    reject: @escaping (String?, String?, Error?) -> Void
  ) {
    reject("unsupported", "iOS can't start a hotspot from an app", nil)
  }

  @objc(stopHotspot:reject:)
  func stopHotspot(
    _ resolve: @escaping (Any?) -> Void,
    reject: @escaping (String?, String?, Error?) -> Void
  ) {
    resolve(nil)
  }

  @objc(getWifiIp:reject:)
  func getWifiIp(
    _ resolve: @escaping (Any?) -> Void,
    reject: @escaping (String?, String?, Error?) -> Void
  ) {
    resolve(CampNet.address(of: CampNet.wifiIface))
  }

  @objc(getHotspotIp:reject:)
  func getHotspotIp(
    _ resolve: @escaping (Any?) -> Void,
    reject: @escaping (String?, String?, Error?) -> Void
  ) {
    resolve(CampNet.address(of: CampNet.hotspotIface))
  }

  /// First IPv4 address of `iface` that is up, as `{ ip, iface }`, or nil.
  private static func address(of iface: String) -> [String: String]? {
    var first: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&first) == 0, let head = first else {
      return nil
    }
    defer { freeifaddrs(first) }

    var cursor: UnsafeMutablePointer<ifaddrs>? = head
    while let entry = cursor?.pointee {
      cursor = entry.ifa_next
      guard
        let addr = entry.ifa_addr,
        addr.pointee.sa_family == UInt8(AF_INET),
        (entry.ifa_flags & UInt32(IFF_UP)) != 0,
        String(cString: entry.ifa_name) == iface
      else {
        continue
      }
      var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
      let status = getnameinfo(
        addr,
        socklen_t(addr.pointee.sa_len),
        &host,
        socklen_t(host.count),
        nil,
        0,
        NI_NUMERICHOST
      )
      if status == 0 {
        return ["ip": String(cString: host), "iface": iface]
      }
    }
    return nil
  }
}
