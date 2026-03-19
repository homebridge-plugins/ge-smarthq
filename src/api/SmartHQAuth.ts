// Simple metrics tracker for demonstration
import fetch from 'node-fetch'
import { retry } from './SmartHQDevice.js'
import { SmartHQApiError } from './SmartHQApiError.js'
import { SmartHQLogger } from './SmartHQLogger.js'

const authMetrics = { healthChecks: 0, healthFailures: 0 }

/**
 * Handles OAuth2 authentication for SmartHQ APIs.
 * Implements token exchange, refresh, browser-based login/logout, and registration flows.
 * See: https://developer.smarthq.com/apis/identity-and-access-management
 */
export class SmartHQAuth {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiresAt: number = 0

  /**
   * Create a new SmartHQAuth instance.
   * @param {object} options - OAuth2 client credentials and redirect URI
   * @param {string} options.clientId - OAuth2 client ID
   * @param {string} options.clientSecret - OAuth2 client secret
   * @param {string} options.redirectUri - OAuth2 redirect URI
   */
  constructor(options: { clientId: string, clientSecret: string, redirectUri: string }) {
    this.clientId = options.clientId
    this.clientSecret = options.clientSecret
    this.redirectUri = options.redirectUri
  }

  /**
   * Refresh access token using the refresh token.
   * @throws SmartHQApiError if refresh fails or no refresh token is available
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new SmartHQApiError('No refresh token available')
    }
    const url = 'https://accounts.brillion.geappliances.com/oauth2/token'
    const params = new URLSearchParams()
    params.append('grant_type', 'refresh_token')
    params.append('client_id', this.clientId)
    params.append('client_secret', this.clientSecret)
    params.append('refresh_token', this.refreshToken)

    const res = await retry(() => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }))
    if (!res.ok) {
      let details
      try {
        details = await res.json()
      } catch {
        details = undefined
      }
      throw new SmartHQApiError(`Token refresh failed: ${res.statusText}`, res.status, undefined, details)
    }
    const data = await res.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }
    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token || this.refreshToken
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000
  }

  /**
   * Get a valid access token, refreshing if needed.
   * @returns Access token string
   * @throws Error if no access token is available
   */
  async getAccessToken(): Promise<string> {
    if (!this.accessToken || Date.now() > this.tokenExpiresAt) {
      await this.refreshAccessToken()
    }
    if (!this.accessToken) {
      throw new Error('No access token available')
    }
    return this.accessToken
  }

  /**
   * Get the OAuth2 authorization URL for browser-based login.
   * @param state - Optional state parameter for CSRF protection
   * @param accessType - 'offline' (default) or 'online'
   * @returns Authorization URL
   */
  getAuthorizationUrl(state?: string, accessType: 'offline' | 'online' = 'offline'): string {
    const base = 'https://accounts.brillion.geappliances.com/oauth2/auth'
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      access_type: accessType,
    })
    if (state) {
      params.append('state', state)
    }
    return `${base}?${params.toString()}`
  }

  /**
   * Get the OAuth2 logout URL for browser-based logout.
   * @param state - Optional state parameter
   * @returns Logout URL
   */
  getLogoutUrl(state?: string): string {
    const base = 'https://accounts.brillion.geappliances.com/oauth2/applogout'
    const params = new URLSearchParams()
    if (state) {
      params.append('state', state)
    }
    return `${base}?${params.toString()}`
  }

  /**
   * Perform OAuth logout via API (invalidates the current session).
   * See: https://docs.smarthq.com/device-control-and-monitoring/authorization/#app-logout-use-case
   * @param state - Optional state parameter
   * @throws SmartHQApiError if logout fails
   */
  async logout(state?: string): Promise<void> {
    const url = 'https://accounts.brillion.geappliances.com/oauth2/applogout'
    const params = new URLSearchParams()
    if (state) {
      params.append('state', state)
    }
    // The API expects a GET request with Authorization header
    const res = await retry(() => fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {},
    }))
    if (!res.ok) {
      let details
      try {
        details = await res.json()
      } catch {
        details = undefined
      }
      throw new SmartHQApiError(`Logout failed: ${res.statusText}`, res.status, undefined, details)
    }
    // Clear local tokens
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiresAt = 0
  }

  /**
   * Get the OAuth2 registration URL for browser-based user registration.
   * @param state - Optional state parameter
   * @param accessType - 'offline' (default) or 'online'
   * @returns Registration URL
   */
  getRegistrationUrl(state?: string, accessType: 'offline' | 'online' = 'offline'): string {
    const base = 'https://accounts.brillion.geappliances.com/oauth2/register'
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      access_type: accessType,
    })
    if (state) {
      params.append('state', state)
    }
    return `${base}?${params.toString()}`
  }

  /**
   * Register a new user via API (if supported).
   * See: https://docs.smarthq.com/device-control-and-monitoring/authorization/#registration-flow
   * Note: Most flows are browser-based, but this provides a direct API call if available.
   * @param registrationData - Registration fields (email, password, etc.)
   * @returns Registration response
   * @throws SmartHQApiError if registration fails
   */
  async registerUser(registrationData: Record<string, any>): Promise<any> {
    const url = 'https://accounts.brillion.geappliances.com/oauth2/register'
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      ...registrationData,
    })
    const res = await retry(() => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }))
    if (!res.ok) {
      let details
      try {
        details = await res.json()
      } catch {
        details = undefined
      }
      throw new SmartHQApiError(`Registration failed: ${res.statusText}`, res.status, undefined, details)
    }
    return await res.json()
  }

  // Logging utility
  private log(event: string, details?: any) {
    if ((this as any)?.config?.debug) {
      SmartHQLogger('SmartHQAuth', event, details)
    }
  }

  /**
   * Health check: verifies token acquisition and refresh.
   * @returns Health status and metrics
   */
  async healthCheck(): Promise<{ ok: boolean, error?: string, metrics: { healthChecks: number, healthFailures: number } }> {
    authMetrics.healthChecks++
    try {
      await this.getAccessToken()
      this.log('Health check: OK')
      return { ok: true, metrics: { ...authMetrics } }
    } catch (err: any) {
      authMetrics.healthFailures++
      this.log('Health check: FAIL', err)
      return { ok: false, error: err?.message || String(err), metrics: { ...authMetrics } }
    }
  }
}
