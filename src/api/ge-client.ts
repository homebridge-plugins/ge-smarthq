import { EventEmitter } from 'events';
import WebSocket from 'ws';  
import axios, { AxiosInstance } from 'axios';
import { GECredentials, GEAppliance, GESmartHQConfig } from '../types';

// Constants from gehomesdk
const OAUTH2_CLIENT_ID = '564c31616c4f7474434b307435412b4d2f6e7672';
const OAUTH2_CLIENT_SECRET = '6476512b5246446d452f697154444941387052645938466e5671746e5847593d';
const OAUTH2_REDIRECT_URI = 'brillion.4e617a766474657344444e562b5935566e51324a://oauth/redirect';
const LOGIN_URL = 'https://accounts.brillion.geappliances.com';
const API_URL = 'https://api.brillion.geappliances.com';
const LOGIN_REGIONS = {
  US: 'us-east-1',
  EU: 'eu-west-1',
};

export interface GEWebSocketMessage {
  kind: string;
  id?: string;
  body?: any;
  success?: boolean;
  code?: number;
  item?: any;
  resource?: string;
}

export class GESmartHQClient extends EventEmitter {
  private config: GESmartHQConfig;
  private httpClient: AxiosInstance;
  private credentials: GECredentials | null = null;
  private websocket: WebSocket | null = null;
  private appliances: Map<string, GEAppliance> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private keepAliveInterval: any = null;

  constructor(config: GESmartHQConfig) {
    super();
    this.config = config;
    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  async authenticate(): Promise<void> {
    try {
      // Get OAuth2 token
      const oauthToken = await this.getOAuth2Token();
      
      // Get WebSocket credentials
      this.credentials = await this.getWebSocketCredentials(oauthToken.access_token);
      
      this.emit('authenticated');
    } catch (error) {
      this.emit('error', new Error(`Authentication failed: ${error}`));
      throw error;
    }
  }

  async connect(): Promise<void> {
    if (!this.credentials) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      this.websocket = new WebSocket(this.credentials.host);
      
      this.websocket.on('open', () => {
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.setupKeepAlive();
        this.subscribeToAppliances();
        this.requestApplianceList();
      });

      this.websocket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        this.handleMessage(data.toString());
      });

      this.websocket.on('close', () => {
        this.emit('disconnected');
        this.clearKeepAlive();
        this.attemptReconnect();
      });

      this.websocket.on('error', (error: Error) => {
        this.emit('error', error);
      });

    } catch (error) {
      this.emit('error', new Error(`Connection failed: ${error}`));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.clearKeepAlive();
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  getAppliances(): GEAppliance[] {
    return Array.from(this.appliances.values());
  }

  getAppliance(macAddr: string): GEAppliance | undefined {
    return this.appliances.get(macAddr.toUpperCase());
  }

  async setERDValue(appliance: GEAppliance, erdCode: string, value: any): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      kind: 'websocket#api',
      action: 'api',
      host: API_URL.replace('https://', ''),
      method: 'POST',
      path: `/v1/appliance/${appliance.macAddr}/erd/${erdCode}`,
      id: `${appliance.macAddr}-setErd-${erdCode}`,
      body: {
        kind: 'appliance#erdListEntry',
        userId: this.credentials?.access_token,
        applianceId: appliance.macAddr,
        erd: erdCode,
        value: value,
        ackTimeout: 10,
        delay: 0,
      },
    };

    this.websocket.send(JSON.stringify(message));
  }

  async requestUpdate(appliance: GEAppliance): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      kind: 'websocket#api',
      action: 'api',
      host: API_URL.replace('https://', ''),
      method: 'GET',
      path: `/v1/appliance/${appliance.macAddr}/erd`,
      id: `${appliance.macAddr}-allErd`,
    };

    this.websocket.send(JSON.stringify(message));
  }

  private async getOAuth2Token(): Promise<any> {
    // Set login cookie
    const cookieHeader = `abgea_region=${LOGIN_REGIONS[this.config.region]}; ` +
                        'Domain=accounts.brillion.geappliances.com; Path=/';
    
    // Get authorization page
    const authParams = {
      client_id: OAUTH2_CLIENT_ID,
      response_type: 'code',
      access_type: 'offline',
      redirect_uri: OAUTH2_REDIRECT_URI,
    };

    const authResponse = await this.httpClient.get(`${LOGIN_URL}/oauth2/auth`, {
      params: authParams,
      headers: { Cookie: cookieHeader },
    });

    // Extract form data from HTML response
    const formDataMatch = authResponse.data.match(/<form[^>]*id="frmsignin"[^>]*>([\s\S]*?)<\/form>/);
    if (!formDataMatch) {
      throw new Error('Could not find login form');
    }

    const inputMatches = formDataMatch[1].match(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/g) || [];
    const formData: Record<string, string> = {};
    
    for (const inputMatch of inputMatches) {
      const nameMatch = inputMatch.match(/name="([^"]+)"/);
      const valueMatch = inputMatch.match(/value="([^"]*)"/);
      if (nameMatch && valueMatch) {
        formData[nameMatch[1]] = valueMatch[1];
      }
    }

    // Add credentials
    formData.username = this.config.username;
    formData.password = this.config.password;

    // Submit login form
    const loginResponse = await this.httpClient.post(`${LOGIN_URL}/oauth2/g_authenticate`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader,
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 400,
    });

    // Extract authorization code from redirect
    let authCode: string;
    if (loginResponse.status === 302 && loginResponse.headers.Location) {
      const urlParams = new URLSearchParams(loginResponse.headers.Location.split('?')[1]);
      authCode = urlParams.get('code')!;
    } else {
      throw new Error('Failed to get authorization code');
    }

    // Exchange code for token
    const tokenData = {
      code: authCode,
      client_id: OAUTH2_CLIENT_ID,
      client_secret: OAUTH2_CLIENT_SECRET,
      redirect_uri: OAUTH2_REDIRECT_URI,
      grant_type: 'authorization_code',
    };

    const tokenResponse = await this.httpClient.post(`${LOGIN_URL}/oauth2/token`, tokenData, {
      auth: {
        username: OAUTH2_CLIENT_ID,
        password: OAUTH2_CLIENT_SECRET,
      },
    });

    return tokenResponse.data;
  }

  private async getWebSocketCredentials(accessToken: string): Promise<GECredentials> {
    const response = await this.httpClient.get(`${API_URL}/v1/websocket`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return {
      host: response.data.endpoint,
      access_token: accessToken,
      expires_in: response.data.expires_in || 3600,
    };
  }

  private setupKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        const pingMessage = {
          kind: 'websocket#ping',
          id: 'keepalive-ping',
          action: 'ping',
        };
        this.websocket.send(JSON.stringify(pingMessage));
      }
    }, 30000); // 30 seconds
  }

  private clearKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    setTimeout(async () => {
      try {
        await this.authenticate();
        await this.connect();
      } catch (error) {
        this.emit('error', error);
      }
    }, delay);
  }

  private subscribeToAppliances(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const subscribeMessage = {
      kind: 'websocket#subscribe',
      action: 'subscribe',
      resources: ['/appliance/*/erd/*'],
    };

    this.websocket.send(JSON.stringify(subscribeMessage));
  }

  private requestApplianceList(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const listMessage = {
      kind: 'websocket#api',
      action: 'api',
      host: API_URL.replace('https://', ''),
      method: 'GET',
      path: '/v1/appliance',
      id: 'List-appliances',
    };

    this.websocket.send(JSON.stringify(listMessage));
  }

  private handleMessage(data: string): void {
    try {
      const message: GEWebSocketMessage = JSON.parse(data);
      
      if (message.kind === 'publish#erd') {
        this.handleERDUpdate(message);
      } else if (message.kind === 'websocket#api') {
        if (message.id === 'List-appliances') {
          this.handleApplianceList(message);
        } else if (message.id?.includes('-allErd')) {
          this.handleCacheUpdate(message);
        }
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to parse message: ${error}`));
    }
  }

  private handleApplianceList(message: GEWebSocketMessage): void {
    if (!message.body?.items) return;

    for (const item of message.body.items) {
      const macAddr = item.applianceId.toUpperCase();
      const online = item.online.toUpperCase() === 'ONLINE';
      
      if (!this.appliances.has(macAddr)) {
        const appliance: GEAppliance = {
          macAddr,
          nickname: item.nickname,
          applianceType: item.type,
          applianceId: item.applianceId,
          available: online,
          erd: {},
        };
        
        this.appliances.set(macAddr, appliance);
        this.emit('appliance_added', appliance);
        
        // Request initial update
        this.requestUpdate(appliance);
      } else {
        const appliance = this.appliances.get(macAddr)!;
        appliance.available = online;
        this.emit('appliance_availability_changed', appliance, online);
      }
    }
  }

  private handleERDUpdate(message: GEWebSocketMessage): void {
    if (!message.item) return;
    
    const macAddr = message.item.applianceId.toUpperCase();
    const appliance = this.appliances.get(macAddr);
    
    if (appliance) {
      appliance.erd[message.item.erd] = message.item.value;
      
      this.emit('appliance_state_changed', appliance, {
        [message.item.erd]: message.item.value,
      });
    }
  }

  private handleCacheUpdate(message: GEWebSocketMessage): void {
    if (!message.body?.items) return;
    
    const macAddr = message.body.applianceId.toUpperCase();
    const appliance = this.appliances.get(macAddr);
    
    if (appliance) {
      const updates: Record<string, any> = {};
      
      for (const item of message.body.items) {
        const oldValue = appliance.erd[item.erd];
        appliance.erd[item.erd] = item.value;
        
        if (oldValue !== item.value) {
          updates[item.erd] = item.value;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        this.emit('appliance_state_changed', appliance, updates);
      }
      
      this.emit('appliance_updated', appliance);
    }
  }
}