# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1](https://github.com/homebridge-plugins/smarthq/releases/tag/v1.0.1) (2026-02-12)

## What's Changed
* No notable changes

**Full Changelog**: https://github.com/homebridge-plugins/smarthq/compare/...v1.0.1

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-11

### Added

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
