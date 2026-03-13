import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SmartHQClient } from '../api/ge-client'

describe('smartHQClient', () => {
  let client: SmartHQClient

  beforeEach(() => {
    client = new SmartHQClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:8888/callback',
      debug: false,
    })
  })

  afterEach(async () => {
    if (client) {
      await client.disconnect().catch(() => {
        // Ignore disconnect errors in tests
      })
    }
  })

  describe('initialization', () => {
    it('should create a client instance', () => {
      expect(client).toBeDefined()
      expect(client).toHaveProperty('authenticate')
      expect(client).toHaveProperty('connect')
      expect(client).toHaveProperty('getDevices')
    })

    it('should have event emitter methods', () => {
      expect(client).toHaveProperty('on')
      expect(client).toHaveProperty('once')
      expect(client).toHaveProperty('emit')
      expect(client).toHaveProperty('off')
    })
  })

  describe('event handling', () => {
    it('should register event listeners', () => {
      const listener = vi.fn()
      client.on('authenticated', listener)
      client.emit('authenticated')
      expect(listener).toHaveBeenCalled()
    })

    it('should support service_update events', () => {
      const listener = vi.fn()
      client.on('service_update', listener)

      const mockMessage = {
        kind: 'pubsub#service',
        deviceId: 'device-123',
        userId: 'user-123',
        adapterId: 'adapter-123',
        serviceId: 'service-123',
        serviceType: 'type',
        domainType: 'domain',
        serviceDeviceType: 'device-type',
        deviceType: 'OVEN',
        lastSyncTime: new Date().toISOString(),
        lastStateTime: new Date().toISOString(),
      }

      client.emit('service_update', mockMessage)
      expect(listener).toHaveBeenCalledWith(mockMessage)
    })

    it('should support error events', () => {
      const listener = vi.fn()
      client.on('error', listener)

      const testError = new Error('Test error')
      client.emit('error', testError)
      expect(listener).toHaveBeenCalledWith(testError)
    })
  })

  describe('cached devices', () => {
    it('should return empty cache initially', () => {
      const cached = client.getCachedDevices()
      expect(Array.isArray(cached)).toBe(true)
      expect(cached.length).toBe(0)
    })

    it('should return undefined for missing cached device', () => {
      const cached = client.getCachedDevice('non-existent-id')
      expect(cached).toBeUndefined()
    })
  })

  describe('connection state', () => {
    it('should not be connected initially', () => {
      expect(client.isConnected()).toBe(false)
    })
  })

  describe('device operations', () => {
    it('should have getDevices method', () => {
      expect(client).toHaveProperty('getDevices')
    })

    it('should have getDevice method', () => {
      expect(client).toHaveProperty('getDevice')
    })

    it('should have getDeviceCount method', () => {
      expect(client).toHaveProperty('getDeviceCount')
    })

    it('should have device cache methods', () => {
      expect(client).toHaveProperty('getCachedDevices')
      expect(client).toHaveProperty('getCachedDevice')
    })
  })

  describe('service operations', () => {
    it('should have service detail methods', () => {
      expect(client).toHaveProperty('getServiceDetails')
      expect(client).toHaveProperty('getServiceHistory')
      expect(client).toHaveProperty('updateDeviceService')
    })
  })

  describe('command operations', () => {
    it('should have sendCommands method', () => {
      expect(client).toHaveProperty('sendCommands')
    })
  })

  describe('alert operations', () => {
    it('should have alert methods', () => {
      expect(client).toHaveProperty('getDeviceAlerts')
      expect(client).toHaveProperty('getRecentAlerts')
      expect(client).toHaveProperty('getAlertReport')
      expect(client).toHaveProperty('getAlertCount')
      expect(client).toHaveProperty('deleteDeviceAlert')
    })
  })

  describe('favorite operations', () => {
    it('should have favorite CRUD methods', () => {
      expect(client).toHaveProperty('getFavorites')
      expect(client).toHaveProperty('saveFavorite')
      expect(client).toHaveProperty('updateFavorite')
      expect(client).toHaveProperty('deleteFavorite')
      expect(client).toHaveProperty('updateFavoriteOrder')
    })
  })

  describe('gateway operations', () => {
    it('should have gateway methods', () => {
      expect(client).toHaveProperty('getGateways')
      expect(client).toHaveProperty('addGateway')
      expect(client).toHaveProperty('removeGateway')
      expect(client).toHaveProperty('getGatewayTags')
      expect(client).toHaveProperty('setGatewayTags')
      expect(client).toHaveProperty('deleteGatewayTags')
    })
  })

  describe('device history operations', () => {
    it('should have device history methods', () => {
      expect(client).toHaveProperty('getDeviceHistory')
      expect(client).toHaveProperty('getCalculatedDeviceHistory')
    })
  })

  describe('device settings operations', () => {
    it('should have device settings methods', () => {
      expect(client).toHaveProperty('getDeviceSettings')
      expect(client).toHaveProperty('getDeviceSetting')
    })
  })

  describe('device tags operations', () => {
    it('should have device tags methods', () => {
      expect(client).toHaveProperty('setDeviceTag')
      expect(client).toHaveProperty('getTagValues')
    })
  })

  describe('file operations', () => {
    it('should have file download method', () => {
      expect(client).toHaveProperty('getFileDownloadUrl')
    })
  })

  describe('schema operations', () => {
    it('should have schema methods', () => {
      expect(client).toHaveProperty('getSchemas')
      expect(client).toHaveProperty('getSchema')
      expect(client).toHaveProperty('validateSchema')
    })
  })

  describe('presence operations', () => {
    it('should have getDevicePresence method', () => {
      expect(client).toHaveProperty('getDevicePresence')
    })
  })

  // Integration tests (marked as skip if no test credentials available)
  describe.skip('integration tests', () => {
    it('should authenticate with valid credentials', async () => {
      // Requires valid GE account credentials in environment
      // Set SMARTHQ_USERNAME and SMARTHQ_PASSWORD before running
      const username = process.env.SMARTHQ_USERNAME
      const password = process.env.SMARTHQ_PASSWORD

      if (!username || !password) {
        throw new Error('Missing SMARTHQ_USERNAME or SMARTHQ_PASSWORD')
      }

      const integrationClient = new SmartHQClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:8888/callback',
        debug: false,
      })

      await integrationClient.authenticate()
      expect(integrationClient).toBeDefined()
    })

    it('should retrieve devices', async () => {
      // Requires valid GE account and authenticated client
      const username = process.env.SMARTHQ_USERNAME
      const password = process.env.SMARTHQ_PASSWORD

      if (!username || !password) {
        throw new Error('Missing SMARTHQ_USERNAME or SMARTHQ_PASSWORD')
      }

      const integrationClient = new SmartHQClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:8888/callback',
        debug: false,
      })

      await integrationClient.authenticate()
      const response = await integrationClient.getDevices()

      expect(response).toHaveProperty('devices')
      expect(Array.isArray(response.devices)).toBe(true)
    })
  })
})
