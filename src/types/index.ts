/**
 * Configuration for SmartHQ API client
 */
export interface SmartHQConfig {
  redirectUri: string
  debug?: boolean
}

/**
 * OAuth2 credentials
 */
export interface SmartHQCredentials {
  access_token?: string
  token_type: string
  expires_in: number
  refresh_token?: string
  expires?: number
}

// ============================================================================
// Device & Service Types (v2 API)
// ============================================================================

export interface Device {
  deviceId: string;
  deviceType: string;
  services?: DeviceService[];
  lastSyncTime: string;
  roomNumber: string;
  serial: string;
  lastPresenceTime: string;
  createdDateTime: string;
  presence: string;
  gatewayId: string;
  room: string;
  icon: string;
  manufacturer: string;
  nickname: string;
  model: string;
  floor: string;
  macAddress: string;
}

export interface DeviceService {
  serviceId: string;
  serviceType: string;
  domainType: string;
  serviceDeviceType: string;
  supportedCommands: string[];
  state?: Record<string, unknown>;
  config?: Record<string, unknown>;
  lastStateTime?: string;
  lastSyncTime?: string;
}

// ============================================================================
// REST API Response Types
// ============================================================================

export interface DeviceListResponse {
  total: number
  devices: Device[]
  page?: number
  perPage?: number
}

export interface DeviceCountResponse {
  total: number
  [key: string]: any
}

export interface ServiceDetailsResponse extends DeviceService {
  [key: string]: any
}

export interface ServiceHistoryResponse {
  items: Array<{
    timestamp: string
    state?: Record<string, any>
    [key: string]: any
  }>
  pageNumber?: number
  pageSize?: number
  total?: number
}

export interface DevicePresenceResponse {
  deviceId: string
  presence?: {
    online: boolean
    lastSyncTime?: string
  }
  history?: Array<{
    timestamp: string
    online: boolean
  }>
}

export interface WebsocketEndpoint {
  endpoint: string
  expires?: number
}

export interface DeviceAlertsResponse {
  items: AlertItem[]
  total: number
}

export interface AlertItem {
  alertId: string
  alertType: string
  deviceId: string
  deviceType: string
  timestamp: string
  severity?: string
  message?: string
  data?: Record<string, any>
}

// ============================================================================
// WebSocket Message Types (v2 API Event Stream)
// ============================================================================

export interface WebSocketMessage {
  kind: string
  action?: string
  id?: string
  success?: boolean
  [key: string]: any
}

export interface ServiceMessage extends WebSocketMessage {
  kind: 'pubsub#service'
  deviceId: string
  userId: string
  adapterId: string
  serviceId: string
  serviceType: string
  domainType: string
  serviceDeviceType: string
  deviceType: string
  lastSyncTime: string
  lastStateTime: string
  state?: Record<string, any>
  config?: Record<string, any>
}

export interface DeviceMessage extends WebSocketMessage {
  kind: 'pubsub#device'
  deviceId: string
  userId: string
  adapterId: string
  deviceType: string
  event: string
  lastSyncTime: string
  services?: DeviceService[]
  gatewayId?: string
}

export interface AlertMessage extends WebSocketMessage {
  kind: 'pubsub#alert'
  deviceId: string
  userId: string
  adapterId: string
  deviceType: string
  alertType: string
  lastAlertTime: string
  services?: Record<string, any>[]
}

export interface PresenceMessage extends WebSocketMessage {
  kind: 'pubsub#presence'
  deviceId: string
  userId: string
  adapterId: string
  deviceType: string
  lastSyncTime: string
  presence?: {
    online?: boolean
    status?: string
  }
}

export interface CommandMessage extends WebSocketMessage {
  kind: 'pubsub#command'
  deviceId: string
  serviceId: string
  commandType: string
  outcome?: string
  correlationId?: string
}

export interface PubsubConfig {
  kind: 'websocket#pubsub' | 'user#pubsub'
  action: 'pubsub'
  pubsub?: boolean
  alerts?: boolean
  services?: boolean
  presence?: boolean
  commands?: boolean
  deviceId?: string
}

// ============================================================================
// Command Types
// ============================================================================

export interface CommandRequest {
  kind: string
  [key: string]: any
}

export interface SendCommandRequest {
  kind: string
  deviceId: string
  serviceType: string
  domainType: string
  serviceDeviceType: string
  command: Record<string, any>
  successOnNoDeviceMatches?: boolean
}

export interface SendCommandSuccessResponse {
  correlationId: string
  timestamp: string
}

export interface SendCommandsRequest {
  kind: string
  commands: CommandRequest[]
}

export interface SendCommandsSuccessResponse {
  success: boolean
  outcome: string
  correlationId: string
}

export interface CommandResponse {
  commandId: string
  correlationId: string
  status: string
  timestamp: string
}

// ============================================================================
// Favorite Types
// ============================================================================

export interface Favorite {
  favoriteId: string
  userId: string
  nickname?: string
  deviceId?: string
  serviceId?: string
  description?: string
  picture?: string
  createdTime?: string
  modifiedTime?: string
}

export interface FavoritesResponse {
  items: Favorite[]
  total: number
}

export interface SaveFavoriteRequest {
  kind: 'user#favorite'
  nickname: string
  description?: string
  deviceId?: string
  serviceId?: string
}

export interface SaveFavoriteResponse {
  favoriteId: string
  [key: string]: any
}

export interface UpdateFavoriteRequest {
  kind: 'user#favorite'
  nickname?: string
  description?: string
}

export interface UpdateFavoriteResponse extends Favorite {}

export interface UpdateFavoriteOrderRequest {
  kind: 'user#favoriteorder'
  favoriteIds: string[]
}

export interface UpdateFavoriteOrderResponse {
  updated: boolean
}

// ============================================================================
// Gateway Types
// ============================================================================

export interface Gateway {
  gatewayId: string
  userId: string
  nickname?: string
  gatewayType?: string
  online?: boolean
  lastSyncTime?: string
  macAddress?: string
  serialNumber?: string
  firmwareVersion?: string
}

export interface GatewayResponse extends Gateway {}

export interface GatewayListResponse {
  items: Gateway[]
  total: number
}

export interface GatewayRequest {
  kind: 'appliance#gateway'
  macAddress: string
  nickname?: string
}

export interface GatewayTagBody {
  [key: string]: string
}

export interface GatewayTagsResponse {
  tags: Record<string, string>
}

export interface GatewayTagsRequest {
  kind: 'appliance#gatewaytags'
  tags: GatewayTagBody
}

export interface GatewayTagsManageResponse {
  success: boolean
}

// ============================================================================
// Device History Types
// ============================================================================

export interface DeviceInstantData {
  timestamp: string
  [key: string]: any
}

export interface DeviceHistoryData {
  timestamp: string
  state?: Record<string, any>
  [key: string]: any
}

export interface DeviceHistoryDataset {
  data: DeviceHistoryData[]
  labels?: string[]
}

export interface DeviceHistoryLineResponse {
  data: DeviceHistoryDataset[]
}

export interface DeviceHistoryRawResponse {
  fileId: string
  expires?: string
}

export interface HistoryItem {
  timestamp: string
  [key: string]: any
}

export interface CalculatedDeviceHistoryRequest {
  kind: 'device#calculatedhistory'
  output: 'line' | 'raw'
  data: Array<{
    type: string
    serviceType: string
    domainType: string
    serviceDeviceType: string
    metrics: string[]
  }>
  timeframe: {
    type: string
    after?: string
    before?: string
    interval?: string
    timezone?: string
  }
}

export interface CalculatedDeviceHistoryLineResponse {
  data: DeviceHistoryDataset[]
}

export interface CalculatedDeviceHistoryRawResponse {
  fileId: string
  expires?: string
}

export interface DeviceHistoryRequest {
  kind: 'device#history'
  output: 'line' | 'raw'
  data: Array<{
    type: string
    serviceType: string
    domainType: string
    serviceDeviceType: string
    metrics: string[]
  }>
  timeframe: {
    type: string
    after?: string
    before?: string
    interval?: string
  }
}

// ============================================================================
// Alert Report Types
// ============================================================================

export interface AlertReport {
  items: AlertHistoryEntry[]
  pageNumber?: number
  pageSize?: number
  total?: number
}

export interface AlertHistoryEntry {
  deviceType: string
  lastAlertTime: string
  alertType: string
  model: string
  lastAlertId: string
  deviceId: string
  severity?: string
  message?: string
  resolved?: boolean
}

export interface AlertCountResponse {
  total: number
  [key: string]: any
}

export interface RecentAlertResponse {
  alerts: AlertHistoryEntry[]
  //items: AlertHistoryEntry[]
  total?: number
}

export interface AlertReportRequest {
  after?: string
  before?: string
  group?: boolean
  pageNumber?: number
  pageSize?: number
}

// ============================================================================
// Device Tags & Settings
// ============================================================================

export interface DeviceTag {
  tagName: string
  tagValue: string
}

export interface DeviceSetTagRequest {
  kind: 'user#devicetag'
  tagName: string
  tagValue: string
}

export interface DeviceSetTagResponse {
  tagName: string
  tagValue: string
}

export interface GetTagValuesRequest {
  kind: 'user#gettagvalues'
  filterDeviceType?: string[]
}

export interface GetTagValuesResponse {
  tagName: string
  values: string[]
}

export interface DeviceSetting {
  ruleId: string
  ruleName?: string
  description?: string
  [key: string]: any
}

export interface DeviceSettingResponse extends DeviceSetting {}

// ============================================================================
// File Download Types
// ============================================================================

export interface FileDownloadResponse {
  fileId: string
  url: string
  expires?: string
}

export interface PictureDownloadResponse {
  fileId: string
  url: string
  expires?: string
}

export interface UploadPictureRequest {
  pictureType?: string
  description?: string
  [key: string]: any
}

export interface UploadPictureResponse {
  uploadUrl: string
  pictureId?: string
}

// ============================================================================
// Schema Types
// ============================================================================

export interface SchemaItem {
  name: string
  url: string
}

export interface SchemaListResponse {
  items: SchemaItem[]
}

export interface SchemaResponse {
  [key: string]: any
}

export interface SchemaPolicyValidationRequest {
  kind: string
  [key: string]: any
}

export interface SchemaPolicyValidationResponse {
  valid: boolean
  errors?: string[]
}

// ============================================================================
// Client Events (EventEmitter)
// ============================================================================

export type SmartHQClientEventType
  = | 'authenticated'
    | 'connected'
    | 'disconnected'
    | 'reconnecting'
    | 'token_refreshed'
    | 'error'
    | 'service_update'
    | 'device_event'
    | 'alert'
    | 'presence'
    | 'command_outcome'

export interface ReconnectingEvent {
  attempt: number
  delay: number
}
