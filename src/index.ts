/**
 * @packageDocumentation
 * 
 * GE SmartHQ API Client Library
 * 
 * A TypeScript library for interacting with the GE SmartHQ Digital Twin API v2.
 * Supports device discovery, real-time monitoring via WebSocket, command execution,
 * and alert/presence tracking.
 * 
 * @example
 * ```typescript
 * import { SmartHQClient } from 'ge-smarthq';
 * 
 * const client = new SmartHQClient({
 *   username: 'your-email@example.com',
 *   password: 'your-password',
 *   region: 'US',
 *   debug: false,
 * });
 * 
 * // Authenticate
 * await client.authenticate();
 * 
 * // Get devices
 * const devicesResponse = await client.getDevices();
 * console.log(`Found ${devicesResponse.items.length} devices`);
 * 
 * // Connect to real-time updates
 * client.on('service_update', (message) => {
 *   console.log('Service update:', message);
 * });
 * 
 * await client.connect();
 * 
 * // Send commands
 * await client.sendCommands({
 *   kind: 'appliance#command-request',
 *   commands: [
 *     {
 *       kind: 'appliance#command',
 *       deviceId: 'device-123',
 *       action: 'start',
 *     },
 *   ],
 * });
 * ```
 */

export * from './types/index.js';
export { SmartHQClient } from './api/ge-client.js';
