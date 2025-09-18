import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { GESmartHQConfig, GEAppliance, ApplianceType } from './types';
import { GESmartHQClient } from './api/ge-client';

export class GESmartHQPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // Cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private client!: GESmartHQClient;
  private refreshTimer: any = null;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig & GESmartHQConfig,
    public readonly api: API,
  ) {
    // Validate configuration
    if (!config.username || !config.password) {
      this.log.error('Username and password are required in configuration');
      return;
    }

    this.log.debug('Finished initializing platform:', config.name);

    // Initialize GE SmartHQ client
    this.client = new GESmartHQClient({
      name: config.name,
      username: config.username,
      password: config.password,
      region: config.region || 'US',
      refreshInterval: config.refreshInterval || 5,
      debug: config.debug || false,
    });

    // Set up client event handlers
    this.setupClientEventHandlers();

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  private setupClientEventHandlers(): void {
    this.client.on('authenticated', () => {
      this.log.info('Successfully authenticated with GE SmartHQ');
    });

    this.client.on('connected', () => {
      this.log.info('Connected to GE SmartHQ websocket');
    });

    this.client.on('disconnected', () => {
      this.log.warn('Disconnected from GE SmartHQ websocket');
    });

    this.client.on('error', (error) => {
      this.log.error('GE SmartHQ client error:', error.message);
    });

    this.client.on('appliance_added', (appliance: GEAppliance) => {
      this.log.info(`Discovered appliance: ${appliance.nickname || appliance.macAddr} (${appliance.applianceType})`);
      this.addAccessory(appliance);
    });

    this.client.on('appliance_state_changed', (appliance: GEAppliance, changes: Record<string, any>) => {
      if (this.config.debug) {
        this.log.debug(`State changed for ${appliance.macAddr}:`, changes);
      }
      this.updateAccessoryState(appliance);
    });

    this.client.on('appliance_availability_changed', (appliance: GEAppliance, available: boolean) => {
      this.log.info(`Appliance ${appliance.macAddr} is now ${available ? 'online' : 'offline'}`);
      this.updateAccessoryAvailability(appliance, available);
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  async discoverDevices(): Promise<void> {
    try {
      this.log.info('Starting discovery of GE SmartHQ appliances...');
      
      // Authenticate and connect
      await this.client.authenticate();
      await this.client.connect();

      // Set up periodic refresh
      const refreshInterval = (this.config.refreshInterval || 5) * 60 * 1000; // Convert to milliseconds
      this.refreshTimer = setInterval(() => {
        this.refreshAppliances();
      }, refreshInterval);

    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }

  private async refreshAppliances(): Promise<void> {
    if (this.config.debug) {
      this.log.debug('Refreshing appliance states...');
    }

    const appliances = this.client.getAppliances();
    for (const appliance of appliances) {
      try {
        await this.client.requestUpdate(appliance);
      } catch (error) {
        this.log.error(`Failed to refresh appliance ${appliance.macAddr}:`, error);
      }
    }
  }

  private addAccessory(appliance: GEAppliance): void {
    const uuid = this.api.hap.uuid.generate(appliance.macAddr);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      // Update existing accessory
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
      existingAccessory.context.appliance = appliance;
      this.configureApplianceAccessory(existingAccessory, appliance);
    } else {
      // Create new accessory
      this.log.info('Adding new accessory:', appliance.nickname || appliance.macAddr);
      
      const accessory = new this.api.platformAccessory(
        appliance.nickname || `GE ${appliance.applianceType || 'Appliance'}`,
        uuid,
      );

      accessory.context.appliance = appliance;
      this.configureApplianceAccessory(accessory, appliance);
      
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    }
  }

  private configureApplianceAccessory(accessory: PlatformAccessory, appliance: GEAppliance): void {
    // Set accessory information
    accessory.getService(this.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'General Electric')
      .setCharacteristic(this.Characteristic.Model, appliance.applianceType || 'SmartHQ Appliance')
      .setCharacteristic(this.Characteristic.SerialNumber, appliance.macAddr)
      .setCharacteristic(this.Characteristic.FirmwareRevision, '1.0.0');

    // Configure services based on appliance type
    this.configureApplianceServices(accessory, appliance);
  }

  private configureApplianceServices(accessory: PlatformAccessory, appliance: GEAppliance): void {
    const applianceType = this.getApplianceType(appliance.applianceType);

    switch (applianceType) {
      case ApplianceType.OVEN:
        this.configureOvenServices(accessory, appliance);
        break;
      case ApplianceType.REFRIGERATOR:
        this.configureFridgeServices(accessory, appliance);
        break;
      case ApplianceType.DISHWASHER:
        this.configureDishwasherServices(accessory, appliance);
        break;
      case ApplianceType.LAUNDRY_WASHER:
      case ApplianceType.LAUNDRY_DRYER:
        this.configureLaundryServices(accessory, appliance);
        break;
      default:
        this.configureGenericServices(accessory, appliance);
        break;
    }
  }

  private configureOvenServices(accessory: PlatformAccessory, appliance: GEAppliance): void {
    // Configure as a Thermostat for temperature control
    const service = accessory.getService(this.Service.Thermostat) || 
                   accessory.addService(this.Service.Thermostat);

    service.setCharacteristic(this.Characteristic.Name, appliance.nickname || 'Oven');

    // Current and target temperature
    service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(() => {
        // Return current oven temperature from ERD data
        const currentTemp = this.getERDValue(appliance, '0x5405'); // Example ERD for current temp
        return currentTemp ? parseInt(currentTemp, 16) : 20;
      });

    service.getCharacteristic(this.Characteristic.TargetTemperature)
      .setProps({
        minValue: 0,
        maxValue: 250,
        minStep: 5,
      })
      .onGet(() => {
        const targetTemp = this.getERDValue(appliance, '0x5406'); // Example ERD for target temp
        return targetTemp ? parseInt(targetTemp, 16) : 20;
      })
      .onSet(async (value) => {
        try {
          const hexValue = Math.round(value as number).toString(16).padStart(4, '0');
          await this.client.setERDValue(appliance, '0x5406', hexValue);
        } catch (error) {
          this.log.error('Failed to set oven temperature:', error);
          throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });

    // Current heating/cooling state
    service.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(() => {
        const ovenState = this.getERDValue(appliance, '0x5404'); // Example ERD for oven state
        if (ovenState && ovenState !== '00') {
          return this.Characteristic.CurrentHeatingCoolingState.HEAT;
        }
        return this.Characteristic.CurrentHeatingCoolingState.OFF;
      });

    service.getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .setProps({
        validValues: [
          this.Characteristic.TargetHeatingCoolingState.OFF,
          this.Characteristic.TargetHeatingCoolingState.HEAT,
        ],
      })
      .onGet(() => {
        const ovenState = this.getERDValue(appliance, '0x5404');
        if (ovenState && ovenState !== '00') {
          return this.Characteristic.TargetHeatingCoolingState.HEAT;
        }
        return this.Characteristic.TargetHeatingCoolingState.OFF;
      })
      .onSet(async (value) => {
        try {
          if (value === this.Characteristic.TargetHeatingCoolingState.OFF) {
            await this.client.setERDValue(appliance, '0x5404', '00');
          } else {
            await this.client.setERDValue(appliance, '0x5404', '01');
          }
        } catch (error) {
          this.log.error('Failed to set oven state:', error);
          throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });
  }

  private configureFridgeServices(accessory: PlatformAccessory, appliance: GEAppliance): void {
    // Configure as temperature sensors
    const fridgeService = accessory.getService(this.Service.TemperatureSensor) || 
                         accessory.addService(this.Service.TemperatureSensor, 'Fridge Temperature', 'fridge');

    fridgeService.setCharacteristic(this.Characteristic.Name, 'Fridge Temperature');
    fridgeService.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(() => {
        const fridgeTemp = this.getERDValue(appliance, '0x0101'); // Example ERD for fridge temp
        return fridgeTemp ? parseInt(fridgeTemp, 16) - 40 : 4; // Convert from raw value
      });

    // Add freezer temperature if available
    const freezerService = accessory.getService('Freezer Temperature') || 
                          accessory.addService(this.Service.TemperatureSensor, 'Freezer Temperature', 'freezer');

    freezerService.setCharacteristic(this.Characteristic.Name, 'Freezer Temperature');
    freezerService.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(() => {
        const freezerTemp = this.getERDValue(appliance, '0x0102'); // Example ERD for freezer temp
        return freezerTemp ? parseInt(freezerTemp, 16) - 40 : -18; // Convert from raw value
      });
  }

  private configureDishwasherServices(accessory: PlatformAccessory, appliance: GEAppliance): void {
    // Configure as a switch for basic on/off control
    const service = accessory.getService(this.Service.Switch) || 
                   accessory.addService(this.Service.Switch);

    service.setCharacteristic(this.Characteristic.Name, appliance.nickname || 'Dishwasher');

    service.getCharacteristic(this.Characteristic.On)
      .onGet(() => {
        const state = this.getERDValue(appliance, '0x5010'); // Example ERD for dishwasher state
        return Boolean(state && state !== '00');
      })
      .onSet(async (value) => {
        try {
          const hexValue = value ? '01' : '00';
          await this.client.setERDValue(appliance, '0x5010', hexValue);
        } catch (error) {
          this.log.error('Failed to set dishwasher state:', error);
          throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });
  }

  private configureLaundryServices(accessory: PlatformAccessory, appliance: GEAppliance): void {
    // Configure as a switch for basic on/off control
    const service = accessory.getService(this.Service.Switch) || 
                   accessory.addService(this.Service.Switch);

    const deviceType = appliance.applianceType?.includes('DRYER') ? 'Dryer' : 'Washer';
    service.setCharacteristic(this.Characteristic.Name, appliance.nickname || deviceType);

    service.getCharacteristic(this.Characteristic.On)
      .onGet(() => {
        const state = this.getERDValue(appliance, '0x2001'); // Example ERD for laundry state
        return Boolean(state && state !== '00');
      })
      .onSet(async (value) => {
        try {
          const hexValue = value ? '01' : '00';
          await this.client.setERDValue(appliance, '0x2001', hexValue);
        } catch (error) {
          this.log.error(`Failed to set ${deviceType.toLowerCase()} state:`, error);
          throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });
  }

  private configureGenericServices(accessory: PlatformAccessory, appliance: GEAppliance): void {
    // Configure basic switch service for unknown appliances
    const service = accessory.getService(this.Service.Switch) || 
                   accessory.addService(this.Service.Switch);

    service.setCharacteristic(this.Characteristic.Name, appliance.nickname || 'GE Appliance');

    service.getCharacteristic(this.Characteristic.On)
      .onGet(() => {
        // Try common power ERD codes
        const state = this.getERDValue(appliance, '0x0001') || 
                     this.getERDValue(appliance, '0x0002') ||
                     this.getERDValue(appliance, '0x0005');
        return Boolean(state && state !== '00');
      })
      .onSet(async (value) => {
        try {
          const hexValue = value ? '01' : '00';
          // Try to set common power ERD codes
          await this.client.setERDValue(appliance, '0x0001', hexValue);
        } catch (error) {
          this.log.error('Failed to set appliance state:', error);
          throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      });
  }

  private updateAccessoryState(appliance: GEAppliance): void {
    const uuid = this.api.hap.uuid.generate(appliance.macAddr);
    const accessory = this.accessories.find(acc => acc.UUID === uuid);
    
    if (accessory) {
      // Update the accessory context
      accessory.context.appliance = appliance;
      
      // Trigger characteristic updates by updating services
      const services = accessory.services.filter(service => 
        service.UUID !== this.Service.AccessoryInformation.UUID);
      
      for (const service of services) {
        for (const characteristic of service.characteristics) {
          try {
            // Trigger a read of the characteristic to update its value
            characteristic.getValue();
          } catch (error) {
            // Ignore errors during characteristic updates
          }
        }
      }
    }
  }

  private updateAccessoryAvailability(appliance: GEAppliance, available: boolean): void {
    const uuid = this.api.hap.uuid.generate(appliance.macAddr);
    const accessory = this.accessories.find(acc => acc.UUID === uuid);
    
    if (accessory) {
      accessory.context.appliance = appliance;
      
      // Update reachability if supported
      if ('updateReachability' in accessory) {
        (accessory as any).updateReachability(available);
      }
    }
  }

  private getERDValue(appliance: GEAppliance, erdCode: string): string | undefined {
    return appliance.erd[erdCode];
  }

  private getApplianceType(typeString?: string): ApplianceType {
    if (!typeString) return ApplianceType.UNKNOWN;
    
    const type = typeString.toUpperCase();
    
    if (type.includes('OVEN') || type.includes('RANGE')) return ApplianceType.OVEN;
    if (type.includes('REFRIGERATOR') || type.includes('FRIDGE')) return ApplianceType.REFRIGERATOR;
    if (type.includes('DISHWASHER')) return ApplianceType.DISHWASHER;
    if (type.includes('WASHER')) return ApplianceType.LAUNDRY_WASHER;
    if (type.includes('DRYER')) return ApplianceType.LAUNDRY_DRYER;
    if (type.includes('WATER_HEATER')) return ApplianceType.WATER_HEATER;
    if (type.includes('AIR_CONDITIONER') || type.includes('AC')) return ApplianceType.AIR_CONDITIONER;
    if (type.includes('MICROWAVE')) return ApplianceType.MICROWAVE;
    
    return ApplianceType.UNKNOWN;
  }
}