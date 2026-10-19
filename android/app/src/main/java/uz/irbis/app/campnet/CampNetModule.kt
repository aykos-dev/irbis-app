package uz.irbis.app.campnet

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * Campfire local network (campfire-core AC4): a local-only hotspot the room runs on, and the
 * phone's Wi-Fi address as the fallback. JS wrapper: src/features/campfire-core/native/campNet.ts.
 */
class CampNetModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  private var reservation: WifiManager.LocalOnlyHotspotReservation? = null

  override fun getName(): String = NAME

  private val wifiManager: WifiManager
    get() = reactApplicationContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

  /** Resolves `{ ssid, password, ip }` once the hotspot is up and its interface has an IPv4. */
  @ReactMethod
  fun startHotspot(promise: Promise) {
    closeReservation()
    val callback =
      object : WifiManager.LocalOnlyHotspotCallback() {
        override fun onStarted(started: WifiManager.LocalOnlyHotspotReservation) {
          reservation = started
          Thread { resolveHotspot(started, promise) }.start()
        }

        override fun onStopped() {
          reservation = null
        }

        override fun onFailed(reason: Int) {
          promise.reject(E_HOTSPOT, "Local-only hotspot failed: $reason")
        }
      }
    try {
      wifiManager.startLocalOnlyHotspot(callback, Handler(Looper.getMainLooper()))
    } catch (error: SecurityException) {
      promise.reject(E_PERMISSION, error.message, error)
    } catch (error: IllegalStateException) {
      promise.reject(E_HOTSPOT, error.message, error)
    }
  }

  @ReactMethod
  fun stopHotspot(promise: Promise) {
    closeReservation()
    promise.resolve(null)
  }

  /** IPv4 of the Wi-Fi network the phone is connected to, or null. */
  @ReactMethod
  fun getWifiIp(promise: Promise) {
    val connectivity =
      reactApplicationContext.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val wifi =
      connectivity.allNetworks.firstOrNull { network ->
        connectivity.getNetworkCapabilities(network)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
      }
    val ip =
      wifi
        ?.let { connectivity.getLinkProperties(it) }
        ?.linkAddresses
        ?.map { it.address }
        ?.firstOrNull { it is Inet4Address && !it.isLoopbackAddress }
        ?.hostAddress
    promise.resolve(ip)
  }

  /** Secret screens (campfire-party AC3): FLAG_SECURE blocks screenshots and screen recording. */
  @ReactMethod
  fun setSecure(on: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      if (on) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }

  override fun invalidate() {
    closeReservation()
    super.invalidate()
  }

  private fun closeReservation() {
    reservation?.close()
    reservation = null
  }

  private fun resolveHotspot(started: WifiManager.LocalOnlyHotspotReservation, promise: Promise) {
    val credentials = credentials(started)
    val ip = waitForHotspotIp()
    if (credentials == null || ip == null) {
      closeReservation()
      promise.reject(E_HOTSPOT, "Hotspot started without credentials or address")
      return
    }
    val result =
      Arguments.createMap().apply {
        putString("ssid", credentials.first)
        putString("password", credentials.second)
        putString("ip", ip)
      }
    promise.resolve(result)
  }

  @Suppress("DEPRECATION")
  private fun credentials(started: WifiManager.LocalOnlyHotspotReservation): Pair<String, String>? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val config = started.softApConfiguration
      val ssid =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          config.wifiSsid?.toString()?.removeSurrounding("\"")
        } else {
          config.ssid
        }
      val password = config.passphrase
      return if (ssid != null && password != null) ssid to password else null
    }
    val config = started.wifiConfiguration ?: return null
    val ssid = config.SSID?.removeSurrounding("\"")
    val password = config.preSharedKey?.removeSurrounding("\"")
    return if (ssid != null && password != null) ssid to password else null
  }

  /** The hotspot interface gets its address shortly after `onStarted`; poll for it briefly. */
  private fun waitForHotspotIp(): String? {
    repeat(IP_POLL_ATTEMPTS) {
      hotspotIp()?.let {
        return it
      }
      Thread.sleep(IP_POLL_INTERVAL_MS)
    }
    return null
  }

  private fun hotspotIp(): String? {
    @Suppress("DEPRECATION")
    val stationIp = wifiManager.connectionInfo?.ipAddress ?: 0
    val candidates =
      NetworkInterface.getNetworkInterfaces()
        ?.toList()
        .orEmpty()
        .filter { it.isUp && !it.isLoopback }
        .flatMap { iface ->
          iface.inetAddresses.toList().filterIsInstance<Inet4Address>().map { iface.name to it }
        }
        .filter { (_, address) -> toLittleEndianInt(address) != stationIp }
    val preferred = candidates.firstOrNull { (name, _) -> HOTSPOT_PREFIXES.any { name.startsWith(it) } }
    val fallback = candidates.firstOrNull { (name, _) -> name.startsWith("wlan") }
    return (preferred ?: fallback)?.second?.hostAddress
  }

  private fun toLittleEndianInt(address: Inet4Address): Int {
    val bytes = address.address
    return (bytes[0].toInt() and 0xff) or
      ((bytes[1].toInt() and 0xff) shl 8) or
      ((bytes[2].toInt() and 0xff) shl 16) or
      ((bytes[3].toInt() and 0xff) shl 24)
  }

  companion object {
    const val NAME = "CampNet"
    private const val E_HOTSPOT = "E_HOTSPOT"
    private const val E_PERMISSION = "E_PERMISSION"
    private const val IP_POLL_ATTEMPTS = 15
    private const val IP_POLL_INTERVAL_MS = 200L
    private val HOTSPOT_PREFIXES = listOf("ap", "swlan", "softap")
  }
}
