import UAParser = require('ua-parser-js')

export const getDeviceInfo = (): {
  browser: string
  device: string
  os: string
  full: string
} => {
  if (typeof window === 'undefined') {
    return {
      browser: 'Unknown',
      device: 'Server',
      os: 'Unknown',
      full: 'Server',
    }
  }
  const parser = new UAParser()
  const result = parser.getResult()

  const browser = result.browser.name || 'Unknown Browser'
  const os = `${result.os.name || ''} ${result.os.version || ''}`.trim()

  let device = 'Desktop'
  if (result.device.vendor && result.device.model) {
    device = `${result.device.vendor} ${result.device.model}`
  } else if (result.device.type) {
    device = result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1)
  } else if (os.toLowerCase().includes('mac')) {
    device = 'Mac'
  } else if (os.toLowerCase().includes('windows')) {
    device = 'PC'
  }

  const full = `${browser} on ${device}`

  return { browser, device, os, full }
}
