export interface GESmartHQConfig {
  name: string;
  username: string;
  password: string;
  region: 'US' | 'EU';
  refreshInterval?: number;
  debug?: boolean;
}

export interface GEAppliance {
  macAddr: string;
  nickname?: string;
  applianceType?: string;
  applianceId?: string;
  available: boolean;
  erd: Record<string, any>;
}

export interface GECredentials {
  host: string;
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

export interface ERDCode {
  code: string;
  value: any;
}

export enum ApplianceType {
  OVEN = 'OVEN',
  REFRIGERATOR = 'REFRIGERATOR',
  DISHWASHER = 'DISHWASHER',
  LAUNDRY_WASHER = 'LAUNDRY_WASHER',
  LAUNDRY_DRYER = 'LAUNDRY_DRYER',
  WATER_HEATER = 'WATER_HEATER',
  AIR_CONDITIONER = 'AIR_CONDITIONER',
  MICROWAVE = 'MICROWAVE',
  UNKNOWN = 'UNKNOWN'
}

export enum OvenState {
  OFF = 0,
  PREHEAT = 1,
  BAKE = 2,
  BROIL = 3,
  CONVECTION_BAKE = 4,
  CONVECTION_ROAST = 5,
  WARM = 6,
  PIZZA = 7,
  PROOF = 8,
  STONE = 9,
  CUSTOM = 10
}

export interface OvenStatus {
  currentState: OvenState;
  targetTemperature?: number;
  currentTemperature?: number;
  timerRemaining?: number;
  cookMode?: string;
}