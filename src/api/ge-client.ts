import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import type { AxiosInstance } from 'axios'
import axios from 'axios'
import type {
  AlertCountResponse,
  AlertMessage,
  AlertReport,
  CalculatedDeviceHistoryLineResponse,
  CalculatedDeviceHistoryRawResponse,
  CalculatedDeviceHistoryRequest,
  CommandMessage,
  Device,
  DeviceAlertsResponse,
  DeviceCountResponse,
  DeviceHistoryLineResponse,
  DeviceHistoryRawResponse,
  DeviceListResponse,
  DeviceMessage,
  DevicePresenceResponse,
  DeviceSetTagRequest,
  DeviceSetTagResponse,
  DeviceSetting,
  DeviceSettingResponse,
  FavoritesResponse,
  FileDownloadResponse,
  GatewayListResponse,
  GatewayRequest,
  GatewayResponse,
  GatewayTagsManageResponse,
  GatewayTagsRequest,
  GatewayTagsResponse,
  GetTagValuesRequest,
  GetTagValuesResponse,
  PresenceMessage,
  PubsubConfig,
  RecentAlertResponse,
  SaveFavoriteRequest,
  SaveFavoriteResponse,
  SchemaListResponse,
  SchemaPolicyValidationResponse,
  SchemaResponse,
  SendCommandsRequest,
  SendCommandsSuccessResponse,
  ServiceDetailsResponse,
  ServiceHistoryResponse,
  ServiceMessage,
  SmartHQClientEventType,
  SmartHQConfig,
  SmartHQCredentials,
  UpdateFavoriteOrderRequest,
  UpdateFavoriteOrderResponse,
  UpdateFavoriteRequest,
  UpdateFavoriteResponse,
  WebsocketEndpoint,
} from '../types/index'

// SmartHQ API v2 Constants
const API_BASE_URL = 'https://client.mysmarthq.com'
// eslint-disable-next-line node/prefer-global/process
const OAUTH2_CLIENT_ID = process.env.SMARTHQ_OAUTH2_CLIENT_ID || '564c31616c4f7474434b307435412b4d2f6e7672'
// eslint-disable-next-line node/prefer-global/process
const OAUTH2_CLIENT_SECRET = process.env.SMARTHQ_OAUTH2_CLIENT_SECRET || '6476512b5246446d452f697154444941387052645938466e5671746e5847593d'
const OAUTH2_REDIRECT_URI = 'brillion://oauth/redirect'
const LOGIN_URL = 'https://accounts.brillion.geappliances.com'

const LOGIN_REGIONS = {
  US: 'us-east-1',
  EU: 'eu-west-1',
}

/**
 * GE SmartHQ API Client
 *
 * Provides access to the SmartHQ Digital Twin API v2 with support for:
 * - Device discovery and monitoring
 * - Real-time updates via WebSocket
 * - Command execution
 * - Alert and presence tracking
 */
export class SmartHQClient extends EventEmitter {
  private config: SmartHQConfig
  private httpClient: AxiosInstance
  private credentials: SmartHQCredentials | null = null
  private websocket: WebSocket | null = null
  private devices: Map<string, Device> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private pongTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(config: SmartHQConfig) {
    super()
    this.config = {
      region: 'US',
      debug: false,
      ...config,
    }

    this.httpClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
    })
  }

  /**
   * Authenticate with the SmartHQ API using OAuth2
   */
  async authenticate(): Promise<void> {
    try {
      const tokenData = await this.getOAuth2Token()
      this.credentials = {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in,
        refresh_token: tokenData.refresh_token,
        expires: Date.now() + ((tokenData.expires_in || 3600) * 1000),
      }

      this.httpClient.defaults.headers.common.Authorization = `Bearer ${this.credentials.access_token}`
      this.emit('authenticated')
      this.log('Authenticated successfully')
    } catch (error) {
      const err = new Error(`Authentication failed: ${error}`)
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Refresh the access token using refresh_token
   */
  async refreshToken(): Promise<void> {
    if (!this.credentials?.refresh_token) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await axios.post(`${LOGIN_URL}/oauth2/token`, {
        refresh_token: this.credentials.refresh_token,
        client_id: OAUTH2_CLIENT_ID,
        client_secret: OAUTH2_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }, {
        auth: {
          username: OAUTH2_CLIENT_ID,
          password: OAUTH2_CLIENT_SECRET,
        },
      })

      this.credentials = {
        access_token: response.data.access_token,
        token_type: response.data.token_type || 'Bearer',
        expires_in: response.data.expires_in,
        refresh_token: response.data.refresh_token || this.credentials.refresh_token,
        expires: Date.now() + ((response.data.expires_in || 3600) * 1000),
      }

      this.httpClient.defaults.headers.common.Authorization = `Bearer ${this.credentials.access_token}`
      this.emit('token_refreshed')
      this.log('Token refreshed successfully')
    } catch (error) {
      const err = new Error(`Token refresh failed: ${error}`)
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Connect to the WebSocket for real-time updates
   */
  async connect(): Promise<void> {
    if (!this.credentials) {
      throw new Error('Not authenticated. Call authenticate() first.')
    }

    try {
      const wsEndpoint = await this.getWebSocketEndpoint()
      this.log(`Connecting to WebSocket: ${wsEndpoint.endpoint}`)

      this.websocket = new WebSocket(wsEndpoint.endpoint)

      this.websocket.on('open', () => {
        this.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.emit('connected')
        this.setupPingPong()
        this.configureWebSocket()
      })

      this.websocket.on('message', (data: WebSocket.Data) => {
        this.handleWebSocketMessage(data.toString())
      })

      this.websocket.on('close', () => {
        this.log('WebSocket disconnected, attempting to reconnect...')
        this.emit('disconnected')
        this.clearPingPong()
        this.attemptReconnect()
      })

      this.websocket.on('error', (error: Error) => {
        this.emit('error', error)
      })
    } catch (error) {
      const err = new Error(`WebSocket connection failed: ${error}`)
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Disconnect from the WebSocket
   */
  async disconnect(): Promise<void> {
    this.log('Disconnecting WebSocket')
    this.clearPingPong()
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.websocket !== null && this.websocket.readyState === WebSocket.OPEN
  }

  // ============================================================================
  // REST API v2 Methods
  // ============================================================================

  /**
   * Get list of devices with optional filtering and pagination
   */
  async getDevices(params?: Record<string, any>): Promise<DeviceListResponse> {
    try {
      const response = await this.httpClient.get<DeviceListResponse>('/v2/device', { params })

      // Cache devices
      for (const device of response.data.items) {
        this.devices.set(device.deviceId, device)
      }

      this.log(`Retrieved ${response.data.items.length} devices`)
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to get devices', error)
    }
  }

  /**
   * Get a single device by deviceId
   */
  async getDevice(deviceId: string): Promise<Device> {
    try {
      const response = await this.httpClient.get<Device>(`/v2/device/${deviceId}`)
      this.devices.set(deviceId, response.data)
      this.log(`Retrieved device: ${deviceId}`)
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get device ${deviceId}`, error)
    }
  }

  /**
   * Get number of devices in account with optional filtering
   */
  async getDeviceCount(params?: Record<string, any>): Promise<DeviceCountResponse> {
    try {
      const response = await this.httpClient.get<DeviceCountResponse>('/v2/device/count', { params })
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to get device count', error)
    }
  }

  /**
   * Get service details for a device
   */
  async getServiceDetails(deviceId: string, serviceId: string): Promise<ServiceDetailsResponse> {
    try {
      const response = await this.httpClient.get<ServiceDetailsResponse>(
        `/v2/device/${deviceId}/service/${serviceId}`,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(
        `Failed to get service details for ${deviceId}/${serviceId}`,
        error,
      )
    }
  }

  /**
   * Get service history with pagination
   */
  async getServiceHistory(
    deviceId: string,
    serviceId: string,
    params?: Record<string, any>,
  ): Promise<ServiceHistoryResponse> {
    try {
      const response = await this.httpClient.get<ServiceHistoryResponse>(
        `/v2/device/${deviceId}/service/${serviceId}/history`,
        { params },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(
        `Failed to get service history for ${deviceId}/${serviceId}`,
        error,
      )
    }
  }

  /**
   * Update device service state
   */
  async updateDeviceService(
    deviceId: string,
    serviceId: string,
    command: Record<string, any>,
  ): Promise<void> {
    try {
      await this.httpClient.post(`/v2/device/${deviceId}/service/${serviceId}`, command)
      this.log(`Updated service ${serviceId} on device ${deviceId}`)
    } catch (error) {
      throw this.handleApiError(
        `Failed to update service ${serviceId} on device ${deviceId}`,
        error,
      )
    }
  }

  /**
   * Send commands to devices
   */
  async sendCommands(request: SendCommandsRequest): Promise<SendCommandsSuccessResponse> {
    try {
      const response = await this.httpClient.post<SendCommandsSuccessResponse>(
        '/v2/command',
        request,
      )
      this.log(`Sent ${request.commands.length} command(s)`)
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to send commands', error)
    }
  }

  /**
   * Get alerts for a device
   */
  async getDeviceAlerts(deviceId: string, params?: Record<string, any>): Promise<DeviceAlertsResponse> {
    try {
      const response = await this.httpClient.get<DeviceAlertsResponse>(
        `/v2/device/${deviceId}/alert`,
        { params },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get alerts for device ${deviceId}`, error)
    }
  }

  /**
   * Get device presence history
   */
  async getDevicePresence(
    deviceId: string,
    params?: Record<string, any>,
  ): Promise<DevicePresenceResponse> {
    try {
      const response = await this.httpClient.get<DevicePresenceResponse>(
        `/v2/device/${deviceId}/presence`,
        { params },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get presence for device ${deviceId}`, error)
    }
  }

  /**
   * Get device history with optional filtering and aggregation
   */
  async getDeviceHistory(
    deviceId: string,
    request: Record<string, any>,
  ): Promise<DeviceHistoryLineResponse | DeviceHistoryRawResponse> {
    try {
      const response = await this.httpClient.post(
        `/v2/device/${deviceId}/history`,
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get history for device ${deviceId}`, error)
    }
  }

  /**
   * Get calculated device history with timezone support
   */
  async getCalculatedDeviceHistory(
    deviceId: string,
    request: CalculatedDeviceHistoryRequest,
  ): Promise<CalculatedDeviceHistoryLineResponse | CalculatedDeviceHistoryRawResponse> {
    try {
      const response = await this.httpClient.post(
        `/v2/device/${deviceId}/history/calculated`,
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get calculated history for device ${deviceId}`, error)
    }
  }

  /**
   * Get recent alerts across all devices
   */
  async getRecentAlerts(params?: Record<string, any>): Promise<RecentAlertResponse> {
    try {
      const response = await this.httpClient.get<RecentAlertResponse>(
        '/v2/alert/recent',
        { params },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to get recent alerts', error)
    }
  }

  /**
   * Get alert report by alert type
   */
  async getAlertReport(
    alertType: string,
    params?: Record<string, any>,
  ): Promise<AlertReport> {
    try {
      const response = await this.httpClient.get<AlertReport>(
        `/v2/alert/${alertType}/report`,
        { params },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get alert report for ${alertType}`, error)
    }
  }

  /**
   * Get alert count with optional filtering
   */
  async getAlertCount(params?: Record<string, any>): Promise<AlertCountResponse> {
    try {
      const response = await this.httpClient.get<AlertCountResponse>(
        '/v2/alert/count',
        { params },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to get alert count', error)
    }
  }

  /**
   * Acknowledge or delete a device alert
   */
  async deleteDeviceAlert(
    deviceId: string,
    alertType: string,
  ): Promise<void> {
    try {
      await this.httpClient.delete(
        `/v2/device/${deviceId}/alert/${alertType}`,
      )
      this.log(`Deleted alert ${alertType} for device ${deviceId}`)
    } catch (error) {
      throw this.handleApiError(`Failed to delete alert for device ${deviceId}`, error)
    }
  }

  // ============================================================================
  // Favorites Methods
  // ============================================================================

  /**
   * Get all favorites
   */
  async getFavorites(params?: Record<string, any>): Promise<FavoritesResponse> {
    try {
      const response = await this.httpClient.get<FavoritesResponse>(
        '/v2/favorite',
        { params },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to get favorites', error)
    }
  }

  /**
   * Create a new favorite
   */
  async saveFavorite(request: SaveFavoriteRequest): Promise<SaveFavoriteResponse> {
    try {
      const response = await this.httpClient.post<SaveFavoriteResponse>(
        '/v2/favorite',
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to save favorite', error)
    }
  }

  /**
   * Update an existing favorite
   */
  async updateFavorite(
    favoriteId: string,
    request: UpdateFavoriteRequest,
  ): Promise<UpdateFavoriteResponse> {
    try {
      const response = await this.httpClient.put<UpdateFavoriteResponse>(
        `/v2/favorite/${favoriteId}`,
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to update favorite ${favoriteId}`, error)
    }
  }

  /**
   * Update favorite order
   */
  async updateFavoriteOrder(
    request: UpdateFavoriteOrderRequest,
  ): Promise<UpdateFavoriteOrderResponse> {
    try {
      const response = await this.httpClient.put<UpdateFavoriteOrderResponse>(
        '/v2/favorite/order',
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to update favorite order', error)
    }
  }

  /**
   * Delete a favorite
   */
  async deleteFavorite(favoriteId: string): Promise<void> {
    try {
      await this.httpClient.delete(`/v2/favorite/${favoriteId}`)
      this.log(`Deleted favorite ${favoriteId}`)
    } catch (error) {
      throw this.handleApiError(`Failed to delete favorite ${favoriteId}`, error)
    }
  }

  // ============================================================================
  // Gateway Methods
  // ============================================================================

  /**
   * Get all gateways
   */
  async getGateways(params?: Record<string, any>): Promise<GatewayListResponse> {
    try {
      const response = await this.httpClient.get<GatewayListResponse>(
        '/v2/gateway',
        { params },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to get gateways', error)
    }
  }

  /**
   * Add a new gateway
   */
  async addGateway(request: GatewayRequest): Promise<GatewayResponse> {
    try {
      const response = await this.httpClient.post<GatewayResponse>(
        '/v2/gateway',
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to add gateway', error)
    }
  }

  /**
   * Remove a gateway from the account
   */
  async removeGateway(gatewayId: string, force: boolean = false): Promise<void> {
    try {
      const params = force ? { force: 'true' } : {}
      await this.httpClient.delete(`/v2/gateway/${gatewayId}`, { params })
      this.log(`Removed gateway ${gatewayId}`)
    } catch (error) {
      throw this.handleApiError(`Failed to remove gateway ${gatewayId}`, error)
    }
  }

  /**
   * Get gateway tags
   */
  async getGatewayTags(gatewayId: string): Promise<GatewayTagsResponse> {
    try {
      const response = await this.httpClient.get<GatewayTagsResponse>(
        `/v2/gateway/${gatewayId}/tag`,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get tags for gateway ${gatewayId}`, error)
    }
  }

  /**
   * Set gateway tags
   */
  async setGatewayTags(
    gatewayId: string,
    request: GatewayTagsRequest,
  ): Promise<GatewayTagsManageResponse> {
    try {
      const response = await this.httpClient.post<GatewayTagsManageResponse>(
        `/v2/gateway/${gatewayId}/tag`,
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to set tags for gateway ${gatewayId}`, error)
    }
  }

  /**
   * Delete gateway tags
   */
  async deleteGatewayTags(gatewayId: string, tagNames: string[]): Promise<void> {
    try {
      await this.httpClient.delete(`/v2/gateway/${gatewayId}/tag`, {
        data: { tagNames },
      })
      this.log(`Deleted tags for gateway ${gatewayId}`)
    } catch (error) {
      throw this.handleApiError(`Failed to delete tags for gateway ${gatewayId}`, error)
    }
  }

  // ============================================================================
  // Device Settings Methods
  // ============================================================================

  /**
   * Get device settings
   */
  async getDeviceSettings(deviceId: string): Promise<DeviceSetting[]> {
    try {
      const response = await this.httpClient.get<DeviceSetting[]>(
        `/v2/device/${deviceId}/setting`,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get settings for device ${deviceId}`, error)
    }
  }

  /**
   * Get a specific device setting
   */
  async getDeviceSetting(deviceId: string, ruleId: string): Promise<DeviceSettingResponse> {
    try {
      const response = await this.httpClient.get<DeviceSettingResponse>(
        `/v2/device/${deviceId}/setting/${ruleId}`,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(
        `Failed to get setting ${ruleId} for device ${deviceId}`,
        error,
      )
    }
  }

  // ============================================================================
  // Device Tags Methods
  // ============================================================================

  /**
   * Set a tag on a device
   */
  async setDeviceTag(
    deviceId: string,
    tagName: string,
    request: DeviceSetTagRequest,
  ): Promise<DeviceSetTagResponse> {
    try {
      const response = await this.httpClient.post<DeviceSetTagResponse>(
        `/v2/device/${deviceId}/tag/${tagName}`,
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to set tag on device ${deviceId}`, error)
    }
  }

  /**
   * Get all values for a specific tag name
   */
  async getTagValues(
    tagName: string,
    request?: GetTagValuesRequest,
  ): Promise<GetTagValuesResponse> {
    try {
      const response = await this.httpClient.post<GetTagValuesResponse>(
        `/v2/tag/${tagName}/value`,
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get values for tag ${tagName}`, error)
    }
  }

  // ============================================================================
  // File Download Methods
  // ============================================================================

  /**
   * Get presigned S3 URL for file download
   */
  async getFileDownloadUrl(fileId: string): Promise<FileDownloadResponse> {
    try {
      const response = await this.httpClient.get<FileDownloadResponse>(
        `/v2/file/${fileId}`,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get download URL for file ${fileId}`, error)
    }
  }

  // ============================================================================
  // Schema Methods
  // ============================================================================

  /**
   * Get list of available JSON schemas
   */
  async getSchemas(): Promise<SchemaListResponse> {
    try {
      const response = await this.httpClient.get<SchemaListResponse>(
        '/v2/schema',
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to get schemas', error)
    }
  }

  /**
   * Get a specific JSON schema by name
   */
  async getSchema(schemaName: string): Promise<SchemaResponse> {
    try {
      const response = await this.httpClient.get<SchemaResponse>(
        `/v2/schema/${schemaName}`,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to get schema ${schemaName}`, error)
    }
  }

  /**
   * Validate request against a schema
   */
  async validateSchema(
    schemaName: string,
    request: Record<string, any>,
  ): Promise<SchemaPolicyValidationResponse> {
    try {
      const response = await this.httpClient.post<SchemaPolicyValidationResponse>(
        `/v2/schema/${schemaName}`,
        request,
      )
      return response.data
    } catch (error) {
      throw this.handleApiError(`Failed to validate against schema ${schemaName}`, error)
    }
  }

  /**
   * Get all cached devices
   */
  getCachedDevices(): Device[] {
    return Array.from(this.devices.values())
  }

  /**
   * Get a specific cached device
   */
  getCachedDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId)
  }

  // ============================================================================
  // WebSocket Methods
  // ============================================================================

  /**
   * Configure WebSocket subscriptions for events
   */
  private configureWebSocket(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return
    }

    const config: PubsubConfig = {
      kind: 'websocket#pubsub',
      action: 'pubsub',
      services: true,
      alerts: true,
      presence: true,
      commands: true,
    }

    this.websocket.send(JSON.stringify(config))
    this.log('Configured WebSocket subscriptions')
  }

  /**
   * Set up ping/pong keep-alive (30 seconds)
   */
  private setupPingPong(): void {
    if (!this.websocket) {
      return
    }

    this.pingInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        const pingMessage = {
          kind: 'websocket#ping',
          action: 'ping',
          id: `ping-${Date.now()}`,
        }
        this.websocket.send(JSON.stringify(pingMessage))

        // Set timeout waiting for pong
        this.pongTimeout = setTimeout(() => {
          this.log('Pong timeout - reconnecting')
          this.websocket?.close()
        }, 10000)
      }
    }, 30000)

    this.log('Ping/pong keep-alive initialized')
  }

  /**
   * Clear ping/pong timers
   */
  private clearPingPong(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      switch (message.kind) {
        case 'websocket#pong':
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout)
            this.pongTimeout = null
          }
          break

        case 'pubsub#service':
          this.emit('service_update', message as ServiceMessage)
          break

        case 'pubsub#device':
          this.emit('device_event', message as DeviceMessage)
          break

        case 'pubsub#alert':
          this.emit('alert', message as AlertMessage)
          break

        case 'pubsub#presence':
          this.emit('presence', message as PresenceMessage)
          break

        case 'pubsub#command':
          this.emit('command_outcome', message as CommandMessage)
          break
      }
    } catch (error) {
      const err = new Error(`Failed to parse WebSocket message: ${error}`)
      this.emit('error', err)
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const err = new Error('Max reconnection attempts reached')
      this.emit('error', err)
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 30000)

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      delay,
    })

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(async () => {
      try {
        await this.refreshToken()
        await this.connect()
      } catch (error) {
        this.emit('error', new Error(`Reconnection failed: ${error}`))
      }
    }, delay)
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get the WebSocket endpoint URL
   */
  private async getWebSocketEndpoint(): Promise<WebsocketEndpoint> {
    try {
      const response = await this.httpClient.get<WebsocketEndpoint>('/v2/websocket')
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to get WebSocket endpoint', error)
    }
  }

  /**
   * Perform OAuth2 authentication flow
   */
  private async getOAuth2Token(): Promise<any> {
    try {
      const region = LOGIN_REGIONS[this.config.region || 'US'] || LOGIN_REGIONS.US
      const cookieHeader = `abgea_region=${region}; Domain=accounts.brillion.geappliances.com; Path=/`

      // Step 1: Get authorization page
      const authParams = {
        client_id: OAUTH2_CLIENT_ID,
        response_type: 'code',
        access_type: 'offline',
        redirect_uri: OAUTH2_REDIRECT_URI,
      }

      const authResponse = await axios.get(`${LOGIN_URL}/oauth2/auth`, {
        params: authParams,
        headers: { Cookie: cookieHeader },
        validateStatus: () => true,
      })

      // Step 2: Extract form data from HTML response
      const formDataMatch = authResponse.data.match(/<form[^>]*id="frmsignin"[^>]*>([\s\S]*?)<\/form>/)
      if (!formDataMatch) {
        throw new Error('Could not find login form in authentication response')
      }

      const inputMatches = formDataMatch[1].match(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/g) || []
      const formData: Record<string, string> = {}

      for (const inputMatch of inputMatches) {
        const nameMatch = inputMatch.match(/name="([^"]+)"/)
        const valueMatch = inputMatch.match(/value="([^"]*)"/)
        if (nameMatch && valueMatch) {
          formData[nameMatch[1]] = valueMatch[1]
        }
      }

      // Step 3: Add credentials
      formData.username = this.config.username
      formData.password = this.config.password

      // Step 4: Submit login form
      const loginResponse = await axios.post(`${LOGIN_URL}/oauth2/g_authenticate`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieHeader,
        },
        maxRedirects: 0,
        validateStatus: () => true,
      })

      // Step 5: Extract authorization code from redirect
      let authCode: string
      const redirectUrl = loginResponse.headers.location || loginResponse.headers.Location
      if (loginResponse.status === 302 && redirectUrl) {
        const urlParams = new URLSearchParams(redirectUrl.split('?')[1])
        authCode = urlParams.get('code')!
      } else {
        throw new Error('Failed to get authorization code from login response')
      }

      // Step 6: Exchange code for token
      const tokenResponse = await axios.post(`${LOGIN_URL}/oauth2/token`, {
        code: authCode,
        client_id: OAUTH2_CLIENT_ID,
        client_secret: OAUTH2_CLIENT_SECRET,
        redirect_uri: OAUTH2_REDIRECT_URI,
        grant_type: 'authorization_code',
      }, {
        auth: {
          username: OAUTH2_CLIENT_ID,
          password: OAUTH2_CLIENT_SECRET,
        },
        validateStatus: () => true,
      })

      if (tokenResponse.status !== 200) {
        throw new Error(`Token exchange failed with status ${tokenResponse.status}`)
      }

      return tokenResponse.data
    } catch (error) {
      throw new Error(`OAuth2 token retrieval failed: ${error}`)
    }
  }

  /**
   * Handle API errors with consistent formatting
   */
  private handleApiError(message: string, error: any): Error {
    let errorMsg = message

    if (error.response?.status === 401) {
      errorMsg += ' - Unauthorized (invalid credentials)'
    } else if (error.response?.status === 403) {
      errorMsg += ' - Forbidden (insufficient permissions)'
    } else if (error.response?.status === 404) {
      errorMsg += ' - Not found'
    } else if (error.response?.status === 429) {
      errorMsg += ' - Rate limited'
    } else if (error.message) {
      errorMsg += ` - ${error.message}`
    }

    return new Error(errorMsg)
  }

  /**
   * Internal logging utility (respects debug config)
   */
  private log(message: string): void {
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log(`[SmartHQClient] ${message}`)
    }
  }

  /**
   * Emit typed events
   */
  override emit(eventName: SmartHQClientEventType | string, ...args: any[]): boolean {
    return super.emit(eventName, ...args)
  }

  /**
   * Add typed event listeners
   */
  override on(eventName: SmartHQClientEventType | string, listener: (...args: any[]) => void): this {
    return super.on(eventName, listener)
  }

  /**
   * Add typed event listener (once)
   */
  override once(eventName: SmartHQClientEventType | string, listener: (...args: any[]) => void): this {
    return super.once(eventName, listener)
  }
}
