# GE SmartHQ API Client

A TypeScript library for interacting with the **GE SmartHQ Digital Twin API v2**. Supports device discovery, real-time monitoring via WebSocket, command execution, and alert/presence tracking.

## Features

- 🔐 **OAuth2 Authentication** - Secure login with automatic token refresh
- 📱 **Device Discovery** - List and monitor all connected SmartHQ devices
- 🔄 **Real-time Updates** - WebSocket streaming for service updates, alerts, and device events
- 💻 **Command Execution** - Send commands to devices
- 📊 **Device Monitoring** - Track device presence, alerts, and service history
- 🛡️ **Full TypeScript Support** - Complete type definitions for all API interactions
- 🔌 **Event-driven** - EventEmitter-based API for reactive updates

## Installation

```bash
npm install ge-smarthq
```

Or with Yarn:

```bash
yarn add ge-smarthq
```

## Requirements

- Node.js 20.x, 22.x, or 24.x
- npm or yarn package manager
- GE SmartHQ account with OAuth2 credentials (optional - defaults are provided)

## Environment Variables

By default, this library uses public OAuth2 credentials for the GE SmartHQ API. You can override these by setting environment variables (useful for custom or restricted API access):

```bash
# .env file or environment
SMARTHQ_OAUTH2_CLIENT_ID=your_client_id_here
SMARTHQ_OAUTH2_CLIENT_SECRET=your_client_secret_here
```

**Important**: Never commit `.env` files to version control. Use `.env.local` or similar for local development. See [.env.example](.env.example) for the template.

## Quick Start

### Basic Usage

```typescript
import { SmartHQClient } from 'ge-smarthq';

// Create client instance
const client = new SmartHQClient({
  username: 'your-email@example.com',
  password: 'your-password',
  region: 'US', // or 'EU'
  debug: false,
});

// Authenticate
await client.authenticate();

// Get devices
const devicesResponse = await client.getDevices();
console.log(`Found ${devicesResponse.items.length} devices`);

// Connect to real-time updates
await client.connect();

// Handle real-time updates
client.on('service_update', (message) => {
  console.log('Service updated:', message);
});

// Disconnect when done
await client.disconnect();
```

### Sending Commands

```typescript
await client.sendCommands({
  kind: 'appliance#command-request',
  commands: [
    {
      kind: 'appliance#command',
      deviceId: 'your-device-id',
      action: 'start',
    },
  ],
});
```

### Monitoring Device Alerts

```typescript
client.on('alert', (message) => {
  console.log('Device alert:', message);
});

const alerts = await client.getDeviceAlerts('device-id');
console.log('Recent alerts:', alerts.items);
```

### Tracking Device Presence

```typescript
client.on('presence', (message) => {
  console.log('Device presence:', message);
});

const presence = await client.getDevicePresence('device-id');
console.log('Online:', presence.presence?.online);
```

## API Reference

### Configuration

```typescript
interface SmartHQConfig {
  username: string;        // GE account email
  password: string;        // GE account password
  region?: 'US' | 'EU';    // Region (default: 'US')
  debug?: boolean;         // Enable debug logging (default: false)
}
```

### Client Methods

#### Authentication

- **`authenticate(): Promise<void>`** - Log in and obtain OAuth2 credentials

#### Device Management

- **`getDevices(): Promise<DeviceListResponse>`** - Get all devices
- **`getDevice(deviceId: string): Promise<Device>`** - Get a single device
- **`getDeviceCount(): Promise<DeviceCountResponse>`** - Get device count

#### Services

- **`getServiceDetails(deviceId: string, serviceId: string): Promise<ServiceDetailsResponse>`** - Get service state
- **`getServiceHistory(deviceId: string, serviceId: string, start?: string, end?: string): Promise<ServiceHistoryResponse>`** - Get service history
- **`updateDeviceService(deviceId: string, serviceId: string, body: any): Promise<void>`** - Update service state

#### Commands

- **`sendCommands(request: SendCommandsRequest): Promise<SendCommandsSuccessResponse>`** - Execute commands

#### Alerts & Presence

- **`getDeviceAlerts(deviceId: string): Promise<DeviceAlertsResponse>`** - Get device alerts
- **`getDevicePresence(deviceId: string): Promise<DevicePresenceResponse>`** - Get device presence info

#### WebSocket

- **`connect(): Promise<void>`** - Connect to real-time event stream
- **`disconnect(): Promise<void>`** - Disconnect from WebSocket
- **`isConnected(): boolean`** - Check connection status

#### Caching

- **`getCachedDevices(): Device[]`** - Get devices from cache
- **`getCachedDevice(deviceId: string): Device | undefined`** - Get single device from cache

### Events

Listen for real-time updates using the EventEmitter interface:

```typescript
// Service state updates
client.on('service_update', (message: ServiceMessage) => {
  console.log('Service:', message.serviceId, 'State:', message.state);
});

// Device lifecycle events (online/offline, added/removed)
client.on('device_event', (message: DeviceMessage) => {
  console.log('Device event:', message.event);
});

// Device alerts (malfunctions, maintenance, etc.)
client.on('alert', (message: AlertMessage) => {
  console.log('Alert:', message.alertType);
});

// Device presence (online/offline status)
client.on('presence', (message: PresenceMessage) => {
  console.log('Presence:', message.presence);
});

// Command execution results
client.on('command_outcome', (message: CommandMessage) => {
  console.log('Command outcome:', message.outcome);
});

// Authentication events
client.on('authenticated', () => {
  console.log('Successfully authenticated');
});

client.on('token_refreshed', () => {
  console.log('OAuth2 token refreshed');
});

// Connection events
client.on('connected', () => {
  console.log('WebSocket connected');
});

client.on('disconnected', () => {
  console.log('WebSocket disconnected');
});

client.on('reconnecting', (event: ReconnectingEvent) => {
  console.log(`Reconnecting... Attempt ${event.attempt}, retry in ${event.delay}ms`);
});

// Errors
client.on('error', (error: Error) => {
  console.error('Client error:', error);
});
```

## Advanced Usage

### Custom Region and Debug Logging

```typescript
const client = new SmartHQClient({
  username: 'user@example.com',
  password: 'password',
  region: 'EU',
  debug: true, // Enable debug output
});
```

### Error Handling

```typescript
try {
  await client.authenticate();
  await client.connect();
} catch (error) {
  console.error('Failed to initialize client:', error);
}

client.on('error', (error) => {
  console.error('Runtime error:', error);
});
```

### Listening to Multiple Event Types

```typescript
['service_update', 'alert', 'presence'].forEach((event) => {
  client.on(event as any, (message) => {
    console.log(`[${event}]`, message);
  });
});
```

## Supported Device Types

The API supports all GE SmartHQ-enabled appliances, including:

- Ovens & Ranges
- Refrigerators
- Dishwashers
- Washers & Dryers
- Water Heaters
- Air Conditioners
- And more

## Homebridge Integration

To use this library in a Homebridge plugin:

```typescript
import { SmartHQClient } from 'ge-smarthq';

export class SmartHQPlatform implements DynamicPlatformPlugin {
  private client: SmartHQClient;

  constructor(log: Logger, config: PlatformConfig, api: API) {
    this.client = new SmartHQClient({
      username: config.username,
      password: config.password,
      region: config.region || 'US',
      debug: config.debug || false,
    });

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  async discoverDevices() {
    await this.client.authenticate();
    const devices = await this.client.getDevices();
    // Create HomeKit accessories for each device
  }
}
```

## License

MIT © 2024-2026 Homebridge Plugins

## Support

For issues, feature requests, or questions, please visit [GitHub Issues](https://github.com/homebridge-plugins/ge-smarthq/issues).