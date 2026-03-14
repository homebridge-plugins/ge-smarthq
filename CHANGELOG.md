# Changelog

All notable changes to this project will be documented in this file.

## 1.0.1 (2026-03-14)

## [?.?.?](https://github.com/homebridge-plugins/ge-smarthq/releases/tag/v1.0.1) (2026-03-15)

## What's Changed
- OAuth2 initial authentication process for Digital Twin API
- Client Id and Client secret passed via config.schema.json
- Access, refresh tokens and expire changed to static vars
- Additional error handling for 401 (invalid credentials) errors
- Add new function 'sendCommand' for command to single device
- Handling of the http headers (authorization)
- Add requirement for initial setup of SmartHQ account in order to use Digital Twin API

## [1.0.1](https://github.com/homebridge-plugins/ge-smarthq/releases/tag/v1.0.1) (2026-02-12)

## What's Changed
* No notable changes


**Full Changelog**: https://github.com/homebridge-plugins/ge-smarthq/compare/...v1.0.1

## [1.0.0](https://github.com/homebridge-plugins/ge-smarthq/releases/tag/v1.0.0) (2026-02-11)

## What's Changed
- Initial release of GE SmartHQ API client library
- Complete TypeScript support with full type definitions
- OAuth2 authentication with automatic token refresh
- Device discovery and management
- Service state queries and updates
- Command execution
- Alert monitoring
- Device presence tracking
- WebSocket real-time event streaming
  - Service updates (pubsub#service)
  - Device lifecycle events (pubsub#device)
  - Device alerts (pubsub#alert)
  - Device presence (pubsub#presence)
  - Command outcomes (pubsub#command)
- Event-driven API using EventEmitter
- Automatic reconnection with exponential backoff
- Device caching for performance
- Comprehensive error handling
- Support for both US and EU regions
- Full API documentation and examples
- Homebridge integration guide

**Full Changelog**: https://github.com/homebridge-plugins/ge-smarthq/compare/...v1.0.0

