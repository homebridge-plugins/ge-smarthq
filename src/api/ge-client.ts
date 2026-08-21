import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import type { AxiosInstance, AxiosResponse } from 'axios'
import axios from 'axios'
import chalk from 'chalk'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import express from 'express'
import path from 'node:path'
import process from 'node:process'
import type { Server } from 'node:http'
import { parse, stringify } from 'node:querystring'

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
  SendCommandRequest,
  SendCommandsRequest,
  SendCommandsSuccessResponse,
  SendCommandSuccessResponse,
  ServiceDetailsResponse,
  ServiceHistoryResponse,
  ServiceMessage,
  SmartHQClientEventType,
  SmartHQConfig,
  UpdateFavoriteOrderRequest,
  UpdateFavoriteOrderResponse,
  UpdateFavoriteRequest,
  UpdateFavoriteResponse,
  WebsocketEndpoint,
} from '../types/index.js'

// SmartHQ API v2 Constants
const API_BASE_URL = 'https://client.mysmarthq.com'
const LOGIN_URL = 'https://accounts.brillion.geappliances.com'
const TOKEN_STORE = 'smarthq.tokens.json'
const PING_INTERVAL = 60000 // 60 seconds

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
  public httpClient: AxiosInstance
  public websocket: WebSocket | null = null
  private devices: Map<string, Device> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private pongTimeout: ReturnType<typeof setTimeout> | null = null
  private tokenPath: string = ''
  private oauthServer?: Server
  // Static properties to hold tokens and expiration time
  static refresh_token: string = ''
  static access_token: string = ''
  static expires: number = 0

  constructor(
    config: SmartHQConfig,
  ) {
    super()
    this.config = {
      debug: false,
      ...config,
    }

    this.httpClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
    })

    this.tokenPath = path.join(process.cwd(), TOKEN_STORE)

    this.loadAccessToken()

    chalk.level = 1 // Enable chalk colors
  }

  /**
   * Authenticate with the SmartHQ API using OAuth2
   */
  async authenticate(): Promise<void> {
    const tokenPath: string = this.tokenPath
    this.debug(`Checking for existing token at: ${tokenPath}`)

    if (!existsSync(tokenPath)) {
      try {
        await this.getAuthToken()
      } catch (error) {
        const err = new Error(`Authentication error caught in authenticate(): ${error}`)
        this.emit('error', err)
        throw err
      }
    } else {
      this.emit('authenticated')
    }
  }

  /**
   * Refresh the access token using refresh_token
   */
  async refreshAccessToken() {
    this.debug('Refreshing access token using staticrefresh_token')
    return await this.getAccessToken({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: SmartHQClient.refresh_token,
    })
  }

  /**
   * Perform OAuth2 authentication flow
   */
  private async getAuthToken(): Promise<any> {
    // Step 1: Redirect user to SmartHQ authorization endpoint to obtain authorization code

    const app = express()
    const url = new URL(`${this.config.redirectUri}`)
    const pathname: string = url.pathname // e.g. '/callback'
    const port: number = Number.parseInt(url.port, 10)

    const tstamp = new Date().toLocaleString('en-US')
    console.warn(chalk.blue(`[${tstamp}] [SmarthqClient] =======================================================================`))
    console.warn(chalk.blue(`[${tstamp}] [SmarthqClient] Click to login for SmartHQ Auth setup ===>:${chalk.red(`http://localhost:${port}/login`)}`))
    console.warn(chalk.blue(`[${tstamp}] [SmarthqClient] =======================================================================`))

    app.get('/login', async (_req, res) => {
      try {
        const url = `${LOGIN_URL}/oauth2/auth?${stringify({
          response_type: 'code',
          client_id: this.config.clientId || 'not_set',
          redirect_uri: `${this.config.redirectUri}`,
        })}`

        res.redirect(url) /// ====> Redirect to SmartHQ authorization endpoint
      } catch (error) {
        console.error(chalk.blue(`[${tstamp}] [SmarthqClient] /login error: caught in getAuthToken`, error))
        res.status(500).send(`Authentication /login failed: ${error}`)
      };
    })

    app.get(pathname, async (req, res) => { // /callback route handler for SmartHQ OAuth redirect with authorization code
      try {
        // Parse the request URL
        const query = parse(req.url!.split('?')[1])

        const code = query.code?.toString() || ''
        if (!code) {
          console.error(chalk.blue(`[${tstamp}] [SmarthqClient] No code found in callback URL for SmartHQ OAuth`))
        }

        // Step 2: Exchange authorization code for access token

        await this.exchangeCodeForToken(code)

        res.send(`
        <h2>SmartHQ Connected</h2>
        <p>Authorization token saved to file.</p>
        <p>You may close this window.</p>
      `)

        setTimeout(() => this.oauthServer?.close(), 1000)
        return (code)
      } catch (error) {
        console.error(chalk.blue(`[${tstamp}] [SmarthqClient] /callback error: caught in getAuthToken`, error))
        res.status(500).send(`Authentication failed: ${error}`)
      }
    })
    this.oauthServer = app.listen(port, () => {
      this.debug(`SmartHQ OAuth listening on ${port}`)
    })
  }

  async exchangeCodeForToken(code: string) {
    return this.getAccessToken({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code,
    })
  }

  //* ======================================================================================
  async getAccessToken(requestBody: Record<string, string>) {
    try {
      const response = await this.httpClient.post(
        `${LOGIN_URL}/oauth2/token`,
        stringify(requestBody),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )

      this.saveToken(response.data)
    } catch (error) {
      console.error(chalk.blue(`[${new Date().toLocaleString('en-US')}] [SmarthqClient] Error caught in getAccessToken:`, error))
      throw await this.handleApiError('Failed to get access token', error)
    }
  }

  saveToken(data: AxiosResponse['data']) {
    SmartHQClient.refresh_token = data.refresh_token
    SmartHQClient.access_token = data.access_token
    SmartHQClient.expires = Date.now() + data.expires_in * 1000
    // Object.assign(this, data);
    try {
      writeFileSync(this.tokenPath, JSON.stringify(data, null, 2))
    } catch (error) {
      const tstamp = new Date().toLocaleString('en-US')
      console.error(chalk.blue(`[${tstamp}] [SmarthqClient] Error saving token: `, error))
    }
  }

  loadAccessToken() {
    if (!existsSync(this.tokenPath)) {
      return
    }
    const data: string = readFileSync(this.tokenPath).toString('utf8')
    const tokenData = JSON.parse(data)
    // Object.assign(this, tokenData);
    SmartHQClient.refresh_token = tokenData.refresh_token
    SmartHQClient.access_token = tokenData.access_token
    SmartHQClient.expires = Date.now() + tokenData.expires_in * 1000
  }

  getWebSocket() {
    return this.websocket
  }

  /**
   * Connect to the WebSocket for real-time updates
   */
  async connect(): Promise<void> {
    if (!SmartHQClient.access_token) {
      throw new Error('Not authenticated. Call authenticate() first.')
    }

    try {
      const wsEndpoint = await this.getWebSocketEndpoint()

      this.websocket = new WebSocket(wsEndpoint.endpoint)

      this.websocket.on('open', () => {
        this.reconnectAttempts = 0
        this.emit('connected')
        this.debug('WebSocket connection established')
        this.setupPingPong()
        this.configureWebSocket()
      })

      this.websocket.on('message', (data: WebSocket.Data) => {
        this.handleWebSocketMessage(data.toString())
      })

      this.websocket.on('close', () => {
        this.debug('WebSocket connection closed')
        this.emit('disconnected')
        this.clearPingPong()
        this.attemptReconnect()
      })

      this.websocket.on('error', (error: Error) => {
        this.emit('error', error)
        this.debug(`WebSocket connection error: ${error.message}`)
      })
    } catch (error) {
      const err = new Error(`WebSocket connection failed: ${error}`)
      this.emit('error', err)
      console.error(chalk.blue(`[${new Date().toLocaleString('en-US')}] [SmarthqClient] WebSocket connection error:`, error))
    }
  }

  /**
   * Disconnect from the WebSocket
   */
  async disconnect(): Promise<void> {
    this.debug('Disconnecting WebSocket')
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
  async getDevices(retryOn401 = true): Promise<DeviceListResponse> {
    try {
      const response = await this.httpClient.get<DeviceListResponse>('/v2/device', { headers: await this.httpHeaders() },
      )
      // Cache devices
      for (const device of response.data.devices) {
        this.devices.set(device.deviceId, device)
      }
      return response.data
    } catch (error: any) {
      // ⚠️ Retry a 401 ONCE. This used to refresh and then call itself with no
      // attempt cap, so a 401 that refreshing cannot fix - a revoked token, or
      // credentials the token endpoint rejects outright - became an unbounded
      // loop of requests against the API rather than one failure.
      if (error.response?.status === 401 && retryOn401) {
        await this.refreshAccessToken()
        return await this.getDevices(false)
      } else {
        throw this.handleApiError('Failed to get devices', error)
      }
    }
  }

  /**
   * Get a single device by deviceId
   */
  async getDevice(deviceId: string, retryOn401 = true): Promise<Device> {
    try {
      const response = await this.httpClient.get<Device>(`/v2/device/${deviceId}`, { headers: await this.httpHeaders() })
      this.devices.set(deviceId, response.data)
      return response.data
    } catch (error: any) {
      // Retry once only - see the note in getDevices().
      if (error.response?.status === 401 && retryOn401) {
        await this.refreshAccessToken()
        return await this.getDevice(deviceId, false)
      } else {
        throw this.handleApiError(`Failed to get device ${deviceId}`, error)
      }
    }
  }

  /**
   * Get number of devices in account with optional filtering
   */
  async getDeviceCount(params?: Record<string, any>): Promise<DeviceCountResponse> {
    try {
      const response = await this.httpClient.get<DeviceCountResponse>('/v2/device/count', { params, headers: await this.httpHeaders() })
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
        { headers: await this.httpHeaders() },
      )
      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken()
        return await this.getServiceDetails(deviceId, serviceId)
      } else {
        throw this.handleApiError(
          `Failed to get service details for ${deviceId}/${serviceId}`,
          error,
        )
      }
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
        { params, headers: await this.httpHeaders() },
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
      await this.httpClient.post(`/v2/device/${deviceId}/service/${serviceId}`, command, { headers: await this.httpHeaders() })
    } catch (error) {
      throw this.handleApiError(
        `Failed to update service ${serviceId} on device ${deviceId}`,
        error,
      )
    }
  }

  /**
   * Send command to device.
   */
  async sendCommand(request: SendCommandRequest): Promise<SendCommandSuccessResponse> {
    try {
      const response = await this.httpClient.post<SendCommandSuccessResponse>(
        '/v2/command',
        request,
        { headers: await this.httpHeaders() },
      )
      return response.data
    } catch (error) {
      throw this.handleApiError('Failed to send command', error)
    }
  }

  /**
   * Send commands to devices
   */
  async sendCommands(request: SendCommandsRequest): Promise<SendCommandsSuccessResponse> {
    try {
      const response = await this.httpClient.post<SendCommandsSuccessResponse>(
        '/v2/commands',
        request,
        { headers: await this.httpHeaders() },
      )
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
        { params, headers: await this.httpHeaders() },
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
        { params, headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
        { params, headers: await this.httpHeaders() },
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
        { params, headers: await this.httpHeaders() },
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
        { params, headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
      )
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
        { params, headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
      await this.httpClient.delete(`/v2/favorite/${favoriteId}`, { headers: await this.httpHeaders() })
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
        { params, headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
      await this.httpClient.delete(`/v2/gateway/${gatewayId}`, { params, headers: await this.httpHeaders() })
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
        headers: await this.httpHeaders(),
      })
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
      const res = await this.httpClient.get<SchemaListResponse>(
        '/v2/schema',
        { headers: await this.httpHeaders() },
      )
      return res.data
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
        { headers: await this.httpHeaders() },
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
        { headers: await this.httpHeaders() },
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
      pubsub: true,
      services: true,
      alerts: true,
      presence: true,
      commands: true,
    }

    this.websocket.send(JSON.stringify(config))
  }

  /**
   * Set up ping/pong keep-alive (60 seconds)
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
          this.debug('Pong timeout - reconnecting')
          this.websocket?.close()
        }, 10000)
      }
    }, PING_INTERVAL)
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

    this.debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(async () => {
      try {
        await this.refreshAccessToken()
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
      const response = await this.httpClient.get<WebsocketEndpoint>('/v2/websocket', { headers: await this.httpHeaders() },
      )
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          await this.refreshAccessToken()
          return await this.getWebSocketEndpoint()
        }
      }
      throw this.handleApiError('Failed to get WebSocket endpoint', error)
    }
  }

  /**
   * Handle API errors with consistent formatting
   */
  public async handleApiError(message: string, error: any): Promise<Error> {
    let errorMsg = message

    if (error.response?.status === 401) {
      errorMsg += ' - Unauthorized (invalid access token)'
      await this.refreshAccessToken().catch((refreshError) => {
        this.debug(`Token refresh failed: ${refreshError}`)
        this.emit('error', new Error(`Token refresh failed: ${refreshError}`))
      })
    } else if (error.response?.status === 400) {
      errorMsg += ' - Bad Request (missing or invalid parameters)'
    } else if (error.response?.status === 403) {
      errorMsg += ' - Forbidden (insufficient permissions)'
    } else if (error.response?.status === 404) {
      errorMsg += ' - Not found'
    } else if (error.response?.status === 408) {
      errorMsg += ' - Request Timeout'
    } else if (error.response?.status === 409) {
      errorMsg += ' - Device not removable)'
    } else if (error.response?.status === 412) {
      errorMsg += ' - Gateway offline or tag managed at gateway level'
    } else if (error.response?.status === 429) {
      errorMsg += ' - Rate limited'
    } else if (error.message) {
      errorMsg += ` - ${error.message}`
    }
    return new Error(errorMsg)
  }

  /**
   * Intercept expired access token errors and attempt to refresh token before retrying request
   */

  async httpHeaders() {
    if (!SmartHQClient.access_token || Date.now() > SmartHQClient.expires - 60000) { // Refresh token if it's expired or will expire in the next 1 minute (tokens are valid for 60 minutes)
      try {
        await this.refreshAccessToken()
      } catch (error: any) {
        this.debug(`Failed to refresh access token in httpHeaders: ${error.response?.status}`)
      }
    }
    return { Authorization: `Bearer ${SmartHQClient.access_token}` }
  }

  /**
   * Internal logging utility (respects debug config)
   */
  public debug(message: string): void {
    if (this.config.debug) {
      const tstamp = new Date().toLocaleString('en-US')
      console.warn(chalk.white(`[${tstamp}]${chalk.yellow(` [SmartHQClient] ${message}`)}`))
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
