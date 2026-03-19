# Copilot Instructions for SmartHQ Plugin Development

## Always Reference GE SmartHQ APIs

When implementing, refactoring, or documenting code for this project, always reference the official GE SmartHQ API documentation:

- [SmartHQ API Portal](https://developer.smarthq.com/apis)
- [Digital Twin API](https://developer.smarthq.com/apis/digital-twin)
- [Event Stream API](https://developer.smarthq.com/apis/event-stream)
- [Identity and Access Management API](https://developer.smarthq.com/apis/identity-and-access-management)
- [SmartHQ Docs Home](https://docs.smarthq.com)
- [Real-Time Device Updates](https://docs.smarthq.com/device-control-and-monitoring/real-time-device-updates/)

## Implementation Guidelines

- Ensure all endpoints, request/response types, and event types are consistent with the latest GE SmartHQ API specifications.
- Use runtime schema validation (zod) for all API responses and requests.
- Standardize error handling and logging across all modules.
- Add health checks and metrics for production readiness.
- Write and maintain comprehensive test coverage for all API features and edge cases.
- Document all public methods and classes with references to the relevant SmartHQ API docs.

## Documentation and Support

- When in doubt, consult the official documentation links above.
- Keep this file up to date with any new best practices or API changes from GE.
