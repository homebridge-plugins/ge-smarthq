// Simple metrics tracker for demonstration
import fetch from 'node-fetch'
import { Buffer } from 'node:buffer'
import { SmartHQApiError } from './SmartHQApiError.js'
import { SmartHQLogger } from './SmartHQLogger.js'
import type { SmartHQAuth } from './SmartHQAuth.js'

const deviceMetrics = { healthChecks: 0, healthFailures: 0 }
/**
 * Handles Digital Twin API device control and queries.
 * Implements all device, gateway, tag, favorite, alert, and schema endpoints.
 * See: https://developer.smarthq.com/apis/digital-twin
 */
export class SmartHQDevice {
  /**
   * Get tags for a gateway.
   * @param gatewayId - Gateway identifier
   * @returns Gateway tags
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getGatewayTags
   */
  async getGatewayTags(gatewayId: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/gateway/${gatewayId}/tag`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get gateway tags: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Set tags for a gateway.
   * @param gatewayId - Gateway identifier
   * @param tags - Tags to set
   * @returns Updated tags
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/setGatewayTags
   */
  async setGatewayTags(gatewayId: string, tags: Record<string, any>): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/gateway/${gatewayId}/tag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tags),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to set gateway tags: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Delete tags from a gateway.
   * @param gatewayId - Gateway identifier
   * @param tagNames - Array of tag names to delete
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/deleteGatewayTags
   */
  async deleteGatewayTags(gatewayId: string, tagNames: string[]): Promise<void> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/gateway/${gatewayId}/tag`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tagNames }),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to delete gateway tags: ${res.statusText}`, res.status)
    }
  }

  /**
   * Get device settings.
   * @param deviceId - Device identifier
   * @returns Device settings
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getDeviceSettings
   */
  async getDeviceSettings(deviceId: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/setting`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get device settings: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Update a device setting.
   * @param deviceId - Device identifier
   * @param ruleId - Rule identifier
   * @param value - New value
   * @returns Updated setting
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/updateDeviceSetting
   */
  async updateDeviceSetting(deviceId: string, ruleId: string, value: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/setting/${ruleId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to update device setting: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * List permissions/policies for a device.
   * @param deviceId - Device identifier
   * @returns Device policies
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/listDevicePolicies
   */
  async listDevicePolicies(deviceId: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/policy`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to list device policies: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Upload a favorite picture (multipart/form-data).
   * @param deviceId - Device identifier
   * @param file - File buffer
   * @param filename - File name
   * @returns Upload response
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/uploadFavoritePicture
   */
  async uploadFavoritePicture(deviceId: string, file: Buffer, filename: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    // Use FormData if available, else manual multipart
    // Node.js 18+ has global FormData, else use form-data package
    let form: any
    let headers: any = { Authorization: `Bearer ${token}` }
    if (typeof FormData !== 'undefined') {
      form = new FormData()
      form.append('file', file, filename)
      headers = { ...headers, ...form.getHeaders?.() }
    } else {
      // Fallback: manual multipart (not recommended)
      throw new TypeError('FormData not available in this environment')
    }
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/favorite/picture`, {
      method: 'POST',
      headers,
      body: form,
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to upload favorite picture: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  private auth: SmartHQAuth

  /**
   * Create a new SmartHQDevice instance.
   * @param auth - SmartHQAuth instance
   */
  constructor(auth: SmartHQAuth) {
    this.auth = auth
  }

  // Logging utility
  private log(event: string, details?: any) {
    if ((this.auth as any)?.config?.debug) {
      SmartHQLogger('SmartHQDevice', event, details)
    }
  }

  /**
   * Health check: verifies API connectivity.
   * @returns Health status and metrics
   */
  async healthCheck(): Promise<{ ok: boolean, error?: string, metrics: typeof deviceMetrics }> {
    deviceMetrics.healthChecks++
    try {
      await this.listDevices()
      this.log('Health check: OK')
      return { ok: true, metrics: { ...deviceMetrics } }
    } catch (err: any) {
      deviceMetrics.healthFailures++
      this.log('Health check: FAIL', err)
      return { ok: false, error: err?.message || String(err), metrics: { ...deviceMetrics } }
    }
  }

  /**
   * List devices in the user's account.
   * @returns Array of devices
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/listDevices
   */
  async listDevices(): Promise<any[]> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/device', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to list devices: ${res.statusText}`, res.status)
    }
    const data = await res.json() as { devices?: any[] }
    return data.devices || []
  }

  /**
   * Send a command to a device (generic).
   * @param deviceId - Device identifier
   * @param command - Command payload
   * @returns Command response
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/sendCommand
   */
  async sendCommand(deviceId: string, command: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/command', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to send command: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Send batch commands.
   * @param commands - Array of command payloads
   * @returns Batch command response
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/sendBatchCommands
   */
  async sendBatchCommands(commands: any[]): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/commands', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands }),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to send batch commands: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get details for a specific device.
   * @param deviceId - Device identifier
   * @returns Device details
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getDevice
   */
  async getDevice(deviceId: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get device: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Delete a device from the user's account.
   * @param deviceId - Device identifier
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/deleteDevice
   */
  async deleteDevice(deviceId: string): Promise<void> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to delete device: ${res.statusText}`, res.status)
    }
  }

  /**
   * Get alerts for a specific device.
   * @param deviceId - Device identifier
   * @returns Device alerts
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getDeviceAlerts
   */
  async getDeviceAlerts(deviceId: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/alert`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get device alerts: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get batch command history.
   * @returns Batch command history
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getBatchCommandHistory
   */
  async getBatchCommandHistory(): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/commands', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get batch command history: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get recent alerts.
   * @returns Recent alerts
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getRecentAlerts
   */
  async getRecentAlerts(): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/alert/recent', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get recent alerts: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Report an alert.
   * @param alert - Alert payload
   * @returns Alert report response
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/reportAlert
   */
  async reportAlert(alert: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/alert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alert),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to report alert: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get alert count.
   * @returns Alert count
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getAlertCount
   */
  async getAlertCount(): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/alert/count', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get alert count: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get tags for a specific device.
   * @param deviceId - Device identifier
   * @returns Device tags
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getDeviceTags
   */
  async getDeviceTags(deviceId: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/tag`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get device tags: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Set a tag for a device.
   * @param deviceId - Device identifier
   * @param tagName - Tag name
   * @param tagValue - Tag value
   * @returns Updated tag
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/setDeviceTag
   */
  async setDeviceTag(deviceId: string, tagName: string, tagValue: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/tag/${tagName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tagValue }),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to set device tag: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Delete a tag from a device.
   * @param deviceId - Device identifier
   * @param tagName - Tag name
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/deleteDeviceTag
   */
  async deleteDeviceTag(deviceId: string, tagName: string): Promise<void> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/tag/${tagName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to delete device tag: ${res.statusText}`, res.status)
    }
  }

  /**
   * List favorites.
   * @returns Array of favorites
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/listFavorites
   */
  async listFavorites(): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/favorite', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to list favorites: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Add a favorite.
   * @param favorite - Favorite payload
   * @returns Added favorite
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/addFavorite
   */
  async addFavorite(favorite: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/favorite', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(favorite),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to add favorite: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Update a favorite.
   * @param favoriteId - Favorite identifier
   * @param favorite - Favorite payload
   * @returns Updated favorite
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/updateFavorite
   */
  async updateFavorite(favoriteId: string, favorite: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/favorite/${favoriteId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(favorite),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to update favorite: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Delete a favorite.
   * @param favoriteId - Favorite identifier
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/deleteFavorite
   */
  async deleteFavorite(favoriteId: string): Promise<void> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/favorite/${favoriteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to delete favorite: ${res.statusText}`, res.status)
    }
  }

  /**
   * List gateways.
   * @returns Array of gateways
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/listGateways
   */
  async listGateways(): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/gateway', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to list gateways: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Add a gateway.
   * @param gateway - Gateway payload
   * @returns Added gateway
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/addGateway
   */
  async addGateway(gateway: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/gateway', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gateway),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to add gateway: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Delete a gateway.
   * @param gatewayId - Gateway identifier
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/deleteGateway
   */
  async deleteGateway(gatewayId: string): Promise<void> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/gateway/${gatewayId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to delete gateway: ${res.statusText}`, res.status)
    }
  }

  /**
   * Get pubsub config for a device.
   * @param deviceId - Device identifier
   * @returns Pubsub config
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getDevicePubsubConfig
   */
  async getDevicePubsubConfig(deviceId: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/pubsub`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get device pubsub config: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Set pubsub config for a device.
   * @param deviceId - Device identifier
   * @param config - Pubsub config
   * @returns Updated config
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/setDevicePubsubConfig
   */
  async setDevicePubsubConfig(deviceId: string, config: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/pubsub`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to set device pubsub config: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Delete pubsub config for a device.
   * @param deviceId - Device identifier
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/deleteDevicePubsubConfig
   */
  async deleteDevicePubsubConfig(deviceId: string): Promise<void> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/pubsub`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to delete device pubsub config: ${res.statusText}`, res.status)
    }
  }

  /**
   * Get user pubsub config.
   * @returns User pubsub config
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getUserPubsubConfig
   */
  async getUserPubsubConfig(): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/pubsub', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get user pubsub config: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Set user pubsub config.
   * @param config - Pubsub config
   * @returns Updated config
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/setUserPubsubConfig
   */
  async setUserPubsubConfig(config: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/pubsub', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to set user pubsub config: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Delete user pubsub config.
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/deleteUserPubsubConfig
   */
  async deleteUserPubsubConfig(): Promise<void> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/pubsub', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to delete user pubsub config: ${res.statusText}`, res.status)
    }
  }

  /**
   * Download a file by fileId.
   * @param fileId - File identifier
   * @returns File buffer
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/downloadFile
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/file/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to download file: ${res.statusText}`, res.status)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  /**
   * List schemas.
   * @returns Array of schemas
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/listSchemas
   */
  async listSchemas(): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/schema', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to list schemas: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get a schema by name.
   * @param schemaName - Schema name
   * @returns Schema details
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getSchema
   */
  async getSchema(schemaName: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/schema/${schemaName}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get schema: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Test a schema by name.
   * @param schemaName - Schema name
   * @param body - Test payload
   * @returns Test result
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/testSchema
   */
  async testSchema(schemaName: string, body: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/schema/${schemaName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to test schema: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get calculated device history.
   * @param body - Request payload
   * @returns Calculated history
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getCalculatedDeviceHistory
   */
  async getCalculatedDeviceHistory(body: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/device/history/calculated', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get calculated device history: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get instant device metrics.
   * @param body - Request payload
   * @returns Instant metrics
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getInstantDeviceMetrics
   */
  async getInstantDeviceMetrics(body: any): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/device/instant/calculated', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get instant device metrics: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get service history for a device.
   * @param deviceId - Device identifier
   * @param serviceId - Service identifier
   * @returns Service history
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getServiceHistory
   */
  async getServiceHistory(deviceId: string, serviceId: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/service/${serviceId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get service history: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get tag values for a tag name.
   * @param tagName - Tag name
   * @returns Tag values
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getTagValues
   */
  async getTagValues(tagName: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/tag/${tagName}/value`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get tag values: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Get alert history for a device and alert type.
   * @param deviceId - Device identifier
   * @param alertType - Alert type
   * @returns Alert history
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getDeviceAlertHistory
   */
  async getDeviceAlertHistory(deviceId: string, alertType: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/alert/${alertType}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get device alert history: ${res.statusText}`, res.status)
    }
    return await res.json()
  }

  /**
   * Clear alert history for a device and alert type.
   * @param deviceId - Device identifier
   * @param alertType - Alert type
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/clearDeviceAlertHistory
   */
  async clearDeviceAlertHistory(deviceId: string, alertType: string): Promise<void> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/device/${deviceId}/alert/${alertType}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to clear device alert history: ${res.statusText}`, res.status)
    }
  }

  /**
   * Get alert type report.
   * @param alertType - Alert type
   * @returns Alert type report
   * @throws SmartHQApiError if request fails
   * See: https://developer.smarthq.com/apis/digital-twin#operation/getAlertTypeReport
   */
  async getAlertTypeReport(alertType: string): Promise<any> {
    const token = await this.auth.getAccessToken()
    const res = await fetch(`https://client.mysmarthq.com/v2/alert/${alertType}/report`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new SmartHQApiError(`Failed to get alert type report: ${res.statusText}`, res.status)
    }
    return await res.json()
  }
}

// Helper for retry logic
export async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastError: any
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay * 2 ** i))
      }
    }
  }
  throw lastError
}
