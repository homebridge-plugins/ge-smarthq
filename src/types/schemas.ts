// SchemaItem
// Runtime schema validation for SmartHQ API using zod
import { z } from 'zod'

export const SchemaItemSchema = z.object({
  name: z.string(),
  url: z.string(),
})

// SchemaListResponse
export const SchemaListResponseSchema = z.object({
  items: z.array(SchemaItemSchema),
})

// SchemaResponse (allow any shape)
export const SchemaResponseSchema = z.record(z.string(), z.any())

// SchemaPolicyValidationRequest
export const SchemaPolicyValidationRequestSchema = z.object({
  kind: z.string(),
}).catchall(z.any())

// SchemaPolicyValidationResponse
export const SchemaPolicyValidationResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).optional(),
})

export const DeviceSchema = z.object({
  deviceId: z.string(),
  deviceType: z.string(),
  services: z.array(z.object({
    serviceId: z.string(),
    serviceType: z.string(),
    domainType: z.string(),
    serviceDeviceType: z.string(),
    supportedCommands: z.array(z.string()),
    state: z.record(z.string(), z.any()).optional(),
    config: z.record(z.string(), z.any()).optional(),
    lastStateTime: z.string().optional(),
    lastSyncTime: z.string().optional(),
  })).optional(),
  lastSyncTime: z.string(),
  roomNumber: z.string(),
  serial: z.string(),
  lastPresenceTime: z.string(),
  createdDateTime: z.string(),
  presence: z.string(),
  gatewayId: z.string(),
  room: z.string(),
  icon: z.string(),
  manufacturer: z.string(),
  nickname: z.string(),
  model: z.string(),
  floor: z.string(),
  macAddress: z.string(),
})

export const DeviceListResponseSchema = z.object({
  total: z.number(),
  devices: z.array(DeviceSchema),
  page: z.number().optional(),
  perPage: z.number().optional(),
})

export const AlertItemSchema = z.object({
  alertId: z.string(),
  alertType: z.string(),
  deviceId: z.string(),
  deviceType: z.string(),
  timestamp: z.string(),
  severity: z.string().optional(),
  message: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
})

export const DeviceAlertsResponseSchema = z.object({
  items: z.array(AlertItemSchema),
  total: z.number(),
})

export const DeviceCountResponseSchema = z.object({
  total: z.number(),
  // Allow additional properties
}).passthrough()

export const ServiceDetailsResponseSchema = z.object({
  serviceId: z.string(),
  serviceType: z.string(),
  domainType: z.string(),
  serviceDeviceType: z.string(),
  supportedCommands: z.array(z.string()),
  state: z.record(z.string(), z.any()).optional(),
  config: z.record(z.string(), z.any()).optional(),
  lastStateTime: z.string().optional(),
  lastSyncTime: z.string().optional(),
}).passthrough()

export const ServiceHistoryResponseSchema = z.object({
  items: z.array(z.object({
    timestamp: z.string(),
    // Add more fields as needed
  })),
}).passthrough()

export const GatewayTagsResponseSchema = z.object({
  tags: z.array(z.object({
    tagName: z.string(),
    tagValue: z.string(),
    // Add more fields as needed
  })),
}).passthrough()
