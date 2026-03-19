import WebSocket from 'ws'
import { SmartHQLogger } from './SmartHQLogger.js'
import type { SmartHQAuth } from './SmartHQAuth.js'

// EventHandler type for event callbacks
type EventHandler = (data: any) => void
// Simple metrics tracker for demonstration
const eventMetrics = { healthChecks: 0, healthFailures: 0 }
/**
 * Handles Event Stream API (WebSocket) for real-time device updates.
 * Implements event subscription, filtering, acknowledgment, and robust reconnect logic.
 * See: https://developer.smarthq.com/apis/event-stream
 */
export class SmartHQEvents {
  /**
   * Subscribe to specific event types or device events (server-side).
   * @param eventTypes - Array of event type strings
   * @param deviceIds - Optional array of device IDs
   * See: https://developer.smarthq.com/apis/event-stream
   */
  subscribeToEvents(eventTypes: string[], deviceIds?: string[]): void {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      const msg: any = { action: 'subscribe', eventTypes }
      if (deviceIds) {
        msg.deviceIds = deviceIds
      }
      this.ws.send(JSON.stringify(msg))
      this.logEvent('Sent subscribe', msg)
    }
  }

  /**
   * Unsubscribe from specific event types or device events (server-side).
   * @param eventTypes - Array of event type strings
   * @param deviceIds - Optional array of device IDs
   */
  unsubscribeFromEvents(eventTypes: string[], deviceIds?: string[]): void {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      const msg: any = { action: 'unsubscribe', eventTypes }
      if (deviceIds) {
        msg.deviceIds = deviceIds
      }
      this.ws.send(JSON.stringify(msg))
      this.logEvent('Sent unsubscribe', msg)
    }
  }

  /**
   * Filter incoming events client-side (utility).
   * @param eventType - Event type string
   * @param handler - Handler function for the event
   */
  filterEvents(eventType: string, handler: EventHandler): void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = []
    }
    this.handlers[eventType].push(handler)
  }

  /**
   * Acknowledge receipt of an event (if required by API).
   * @param eventId - Event identifier
   */
  acknowledgeEvent(eventId: string): void {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      const msg = { action: 'ack', eventId }
      this.ws.send(JSON.stringify(msg))
      this.logEvent('Sent event ack', msg)
    }
  }

  private auth: SmartHQAuth
  private ws: WebSocket | null = null
  private handlers: { [event: string]: EventHandler[] } = {}
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected'
  private reconnectCount = 0
  private lastError: Error | null = null

  /**
   * Create a new SmartHQEvents instance.
   * @param auth - SmartHQAuth instance
   */
  constructor(auth: SmartHQAuth) {
    this.auth = auth
  }

  // Robust reconnect logic with exponential backoff
  private reconnectAttempts = 0
  private reconnecting = false
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  private startHeartbeat() {
    if (this.ws) {
      this.heartbeatInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.ping()
        }
      }, 30000) // 30s heartbeat
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // Add event logging and metrics
  private logEvent(event: string, details?: any) {
    if (this.auth && (this.auth as any).config?.debug) {
      SmartHQLogger('SmartHQEvents', event, details)
    }
  }

  private setupWebSocket(ws: WebSocket) {
    ws.on('open', () => {
      this.connectionStatus = 'connected'
      this.logEvent('WebSocket connected')
    })
    ws.on('message', (msg: string) => {
      try {
        const parsed = JSON.parse(msg)
        const kind = parsed.kind || 'message'
        this.emit(kind, parsed)
        this.logEvent('Received message', parsed)
      } catch (e) {
        this.logEvent('Message parse error', e)
      }
    })
    ws.on('close', () => {
      this.connectionStatus = 'disconnected'
      this.logEvent('WebSocket closed')
      this.stopHeartbeat()
      this.ws = null
      this.reconnectCount++
      this.reconnect()
    })
    ws.on('error', (err) => {
      this.lastError = err
      this.logEvent('WebSocket error', err)
      this.connectionStatus = 'disconnected'
      this.stopHeartbeat()
      this.ws = null
      this.reconnectCount++
      this.reconnect()
    })
    ws.on('pong', () => {
      this.logEvent('Received pong')
    })
    this.startHeartbeat()
  }

  private async reconnect() {
    if (this.reconnecting) {
      return
    }
    this.reconnecting = true
    this.reconnectAttempts++
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    setTimeout(async () => {
      try {
        await this.connect()
        this.reconnectAttempts = 0
      } catch {
        // Keep trying
        this.reconnect()
      }
      this.reconnecting = false
    }, delay)
  }

  /**
   * Connect to the SmartHQ WebSocket for real-time events (with robust reconnect).
   * @throws Error if WebSocket endpoint cannot be retrieved
   */
  async connect(): Promise<void> {
    if (this.ws) {
      return
    }
    const token = await this.auth.getAccessToken()
    const res = await fetch('https://client.mysmarthq.com/v2/websocket', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new Error(`Failed to get WebSocket endpoint: ${res.statusText}`)
    }
    const data = await res.json()
    const wsUrl = data.url
    this.ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${token}` } })
    this.setupWebSocket(this.ws)
  }

  /**
   * Subscribe to specific event types (multiplex).
   * @param _eventTypes - Array of event type strings
   */

  subscribe(_eventTypes: string[]): void {
    // Optionally send a subscription message to the server if supported
    // For now, just filter emitted events
    // Example: this.ws?.send(JSON.stringify({ action: 'subscribe', eventTypes }))
  }

  // Emit event to handlers
  private emit(event: string, data: any): void {
    (this.handlers[event] || []).forEach(h => h(data))
  }

  /**
   * Disconnect from WebSocket.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.stopHeartbeat()
    }
  }

  /**
   * Get current connection status and metrics.
   * @returns Status, reconnect count, and last error
   */
  getStatus() {
    return {
      status: this.connectionStatus,
      reconnects: this.reconnectCount,
      lastError: this.lastError,
    }
  }

  /**
   * Health check: verifies WebSocket connectivity.
   * @returns Health status and metrics
   */
  async healthCheck(): Promise<{ ok: boolean, error?: string, metrics: typeof eventMetrics }> {
    eventMetrics.healthChecks++
    try {
      await this.connect()
      if (this.ws && this.ws.readyState === this.ws.OPEN) {
        this.logEvent('Health check: OK')
        return { ok: true, metrics: { ...eventMetrics } }
      }
      throw new Error('WebSocket not open')
    } catch (err: any) {
      eventMetrics.healthFailures++
      this.logEvent('Health check: FAIL', err)
      return { ok: false, error: err?.message || String(err), metrics: { ...eventMetrics } }
    }
  }
}
