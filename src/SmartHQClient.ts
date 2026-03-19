// Main client that composes Auth, Device, and Events APIs
import { SmartHQAuth } from './api/SmartHQAuth'
import { SmartHQDevice } from './api/SmartHQDevice'
import { SmartHQEvents } from './api/SmartHQEvents'

export class SmartHQClient {
  public auth: SmartHQAuth
  public device: SmartHQDevice
  public events: SmartHQEvents

  constructor(options: { clientId: string, clientSecret: string, redirectUri: string }) {
    this.auth = new SmartHQAuth(options)
    this.device = new SmartHQDevice(this.auth)
    this.events = new SmartHQEvents(this.auth)
  }
}

// Example usage:
/*
const client = new SmartHQClient({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'YOUR_REDIRECT_URI',
});

// 1. Exchange auth code for tokens (after user login)
await client.auth.fetchToken('AUTH_CODE_FROM_OAUTH_FLOW');

// 2. List devices
const devices = await client.device.listDevices();
console.log(devices);

// 3. Listen for real-time events
await client.events.connect();
client.events.on('pubsub#device', (data) => {
  console.log('Device event:', data);
});
*/
