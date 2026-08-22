# Changelog

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/).

## v1.2.0 (Pending Release)

### Changed

- feat: log the command body before sending it, to help develop new appliance support (#21) (@ceb400)
- chore(deps): dependency updates

## v1.1.1 (2026-08-22)

### Changed

- chore: use the same lint setup as the other plugins, and tidy the changelog to match

## v1.1.0 (2026-08-22)

### Changed

- ci: release on a github release, as the plugins do, and build every push and pr
- chore(deps): dependency updates
- feat(types): report outcome and success from sendCommand (#18) (@ceb400)
- fix: declare chalk as a dependency, and retry a 401 once instead of unbounded (#20) (@mrosenbergtech)
- fix(websocket): wait 30 seconds for a pong, so a healthy connection is not closed (#19)

## v1.0.1 (2026-03-17)

### Changed

- OAuth2 initial authentication process for Digital Twin API
- Client Id and Client secret passed via config.schema.json
- Access, refresh tokens and expire changed to static vars
- Additional error handling for 401 (invalid credentials) errors
- Add new function 'sendCommand' for command to single device
- Handling of the http headers (authorization)
- Add requirement for initial setup of SmartHQ account in order to use Digital Twin API

## v1.0.0 (2026-02-12)

### Changed

- Initial release of GE SmartHQ API client library
- Complete TypeScript support with full type definitions
- OAuth2 authentication with automatic token refresh
- Device discovery and management
- Service state queries and updates
- Command execution
- Alert monitoring
- Device presence tracking
- WebSocket real-time event streaming, covering service updates, device lifecycle events, alerts, presence and command outcomes
- Event-driven API using EventEmitter
- Automatic reconnection with exponential backoff
- Device caching for performance
- Comprehensive error handling
- Support for both US and EU regions
- Full API documentation and examples
- Homebridge integration guide
