# Homebridge GE SmartHQ

[![npm version](https://badgen.net/npm/v/homebridge-ge-smarthq)](https://www.npmjs.com/package/homebridge-ge-smarthq)
[![npm downloads](https://badgen.net/npm/dt/homebridge-ge-smarthq)](https://www.npmjs.com/package/homebridge-ge-smarthq)

A Homebridge plugin that integrates GE SmartHQ appliances with Apple HomeKit. This plugin allows you to monitor and control your GE WiFi-enabled appliances through the Apple Home app.

## Features

- **Real-time monitoring**: Get live status updates from your GE appliances
- **HomeKit integration**: Control appliances through the Apple Home app, Siri, and automation
- **Multiple appliance support**: Works with ovens, refrigerators, dishwashers, washers, dryers, and more
- **Automatic discovery**: Automatically discovers all appliances linked to your GE SmartHQ account
- **WebSocket connection**: Uses GE's WebSocket API for real-time updates

## Supported Appliances

- **Ovens/Ranges**: Temperature control, heating state monitoring
- **Refrigerators**: Temperature monitoring for fridge and freezer compartments
- **Dishwashers**: On/off control and cycle monitoring
- **Washers/Dryers**: On/off control and cycle monitoring
- **Other appliances**: Basic on/off control for unsupported appliance types

## Installation

1. Install Homebridge if you haven't already:
   ```bash
   npm install -g homebridge
   ```

2. Install this plugin:
   ```bash
   npm install -g homebridge-ge-smarthq
   ```

3. Configure the plugin in your Homebridge config (see [Configuration](#configuration) below)

## Configuration

Add the following to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "GESmartHQ",
      "name": "GE SmartHQ",
      "username": "your-smarthq-email@example.com",
      "password": "your-smarthq-password",
      "region": "US",
      "refreshInterval": 5,
      "debug": false
    }
  ]
}
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `platform` | string | Yes | - | Must be `"GESmartHQ"` |
| `name` | string | Yes | - | Display name for the platform |
| `username` | string | Yes | - | Your GE SmartHQ account username/email |
| `password` | string | Yes | - | Your GE SmartHQ account password |
| `region` | string | No | `"US"` | Your SmartHQ region (`"US"` or `"EU"`) |
| `refreshInterval` | number | No | `5` | How often to refresh appliance data (in minutes) |
| `debug` | boolean | No | `false` | Enable debug logging for troubleshooting |

## Usage

Once configured, the plugin will:

1. Authenticate with your GE SmartHQ account
2. Discover all appliances linked to your account
3. Create HomeKit accessories for each appliance
4. Provide real-time status updates via WebSocket connection

### Oven/Range Control
- **Temperature Control**: Set target temperature and monitor current temperature
- **Heating State**: View current heating mode (off, heating)
- **Power Control**: Turn oven on/off

### Refrigerator Monitoring
- **Temperature Sensors**: Monitor fridge and freezer temperatures
- **Status Updates**: Real-time temperature monitoring

### Dishwasher/Laundry Control
- **Power Control**: Start/stop cycles
- **Status Monitoring**: Monitor running state

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify your GE SmartHQ username and password are correct
   - Check if your account region is set correctly (US/EU)
   - Try logging into the GE SmartHQ app to verify credentials

2. **No Appliances Found**
   - Ensure your appliances are connected to WiFi and registered in the GE SmartHQ app
   - Check that appliances are showing as online in the GE SmartHQ app
   - Wait a few minutes after adding appliances to your GE account

3. **Connection Issues**
   - Check your internet connection
   - Restart Homebridge
   - Enable debug logging to see detailed error messages

### Debug Logging

Enable debug logging by setting `"debug": true` in your configuration. This will provide detailed logs about:
- Authentication process
- WebSocket connection status
- Appliance discovery
- State changes and ERD updates

## API Reference

This plugin is based on the excellent work of the [gehomesdk](https://github.com/simbaja/gehome) Python library, which provides comprehensive documentation of GE's SmartHQ APIs and appliance ERD codes.

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/homebridge-plugins/ge-smarthq.git
cd ge-smarthq

# Install dependencies
npm install

# Build the plugin
npm run build

# Link for development
npm link
```

### Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [simbaja/gehome](https://github.com/simbaja/gehome) - Python SDK that this plugin is based on
- [ajmarks/gekitchen](https://github.com/ajmarks/gekitchen) - Original GE Kitchen API work
- Homebridge community for the excellent platform

## Disclaimer

This plugin is not officially associated with or endorsed by General Electric. GE SmartHQ is a trademark of General Electric Company.