// Demo data for ORBCOMM KAGU fleet when API is not available
const DEMO_ASSETS = [
    {
        assetId: 'KAGU3331339',
        status: 'online',
        deviceId: 'JJJC125090470',
        lastUpdate: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        gpsData: {
            hasGPS: true,
            latitude: -6.82037,
            longitude: 113.116607,
            lockState: 'GPS_LOCK',
            satelliteCount: 8
        },
        deviceData: {
            batteryVoltage: 3.9,
            rssi: -67,
            extPower: true,
            extPowerVoltage: 12.5,
            deviceTemp: 35.2
        },
        reeferData: {
            hasReeferData: true,
            ambientTemp: 30.5,
            setTemp: 3,
            supplyTemp1: 2.81,
            returnTemp1: 5.88
        }
    },
    {
        assetId: 'SZLU9721417',
        status: 'offline',
        deviceId: 'JJJC125090556',
        lastUpdate: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        gpsData: {
            hasGPS: true,
            latitude: -7.19818,
            longitude: 112.710952,
            lockState: 'GPS_LOCK',
            satelliteCount: 6
        },
        deviceData: {
            batteryVoltage: 2.1,
            rssi: -89,
            extPower: false,
            extPowerVoltage: 0,
            deviceTemp: 28.5
        },
        reeferData: {
            hasReeferData: true,
            ambientTemp: 31.5,
            setTemp: -25,
            supplyTemp1: -28.19,
            returnTemp1: -24.5
        }
    },
    {
        assetId: 'TRIU8784787',
        status: 'online',
        deviceId: 'JJJC125090472',
        lastUpdate: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
        gpsData: {
            hasGPS: true,
            latitude: -5.15,
            longitude: 119.45,
            lockState: 'GPS_LOCK',
            satelliteCount: 7
        },
        deviceData: {
            batteryVoltage: 3.2,
            rssi: -72,
            extPower: true,
            extPowerVoltage: 11.8,
            deviceTemp: 33.1
        },
        reeferData: {
            hasReeferData: false
        }
    },
    {
        assetId: 'KAGU3330950',
        status: 'delayed',
        deviceId: 'JJJC125090473',
        lastUpdate: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        gpsData: {
            hasGPS: true,
            latitude: -3.5,
            longitude: 114.8,
            lockState: 'GPS_PARTIAL',
            satelliteCount: 4
        },
        deviceData: {
            batteryVoltage: 3.5,
            rssi: -75,
            extPower: true,
            extPowerVoltage: 12.1,
            deviceTemp: 36.8
        },
        reeferData: {
            hasReeferData: true,
            ambientTemp: 28.2,
            setTemp: 5,
            supplyTemp1: 4.5,
            returnTemp1: 7.2
        }
    },
    {
        assetId: 'KAGU3330820',
        status: 'never_seen',
        deviceId: null,
        lastUpdate: null,
        gpsData: {
            hasGPS: false
        },
        deviceData: {},
        reeferData: {
            hasReeferData: false
        }
    },
    {
        assetId: 'SZLU3961914',
        status: 'online',
        deviceId: 'JJJC125090474',
        lastUpdate: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
        gpsData: {
            hasGPS: true,
            latitude: -4.2,
            longitude: 117.3,
            lockState: 'GPS_LOCK',
            satelliteCount: 9
        },
        deviceData: {
            batteryVoltage: 4.1,
            rssi: -63,
            extPower: true,
            extPowerVoltage: 13.2,
            deviceTemp: 32.4
        },
        reeferData: {
            hasReeferData: true,
            ambientTemp: 29.8,
            setTemp: 0,
            supplyTemp1: -1.2,
            returnTemp1: 2.1
        }
    },
    {
        assetId: 'KAGU3331180',
        status: 'offline',
        deviceId: 'JJJC125090475',
        lastUpdate: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
        gpsData: {
            hasGPS: true,
            latitude: -2.8,
            longitude: 115.2,
            lockState: 'GPS_LOCK',
            satelliteCount: 5
        },
        deviceData: {
            batteryVoltage: 2.8,
            rssi: -92,
            extPower: false,
            extPowerVoltage: 0,
            deviceTemp: 25.7
        },
        reeferData: {
            hasReeferData: false
        }
    },
    {
        assetId: 'KAGU3331283',
        status: 'never_seen',
        deviceId: null,
        lastUpdate: null,
        gpsData: {
            hasGPS: false
        },
        deviceData: {},
        reeferData: {
            hasReeferData: false
        }
    },
    {
        assetId: 'KAGU7771228',
        status: 'never_seen',
        deviceId: null,
        lastUpdate: null,
        gpsData: {
            hasGPS: false
        },
        deviceData: {},
        reeferData: {
            hasReeferData: false
        }
    },
    {
        assetId: 'KAGU3331302',
        status: 'online',
        deviceId: 'JJJC125090476',
        lastUpdate: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        gpsData: {
            hasGPS: true,
            latitude: -1.5,
            longitude: 116.8,
            lockState: 'GPS_LOCK',
            satelliteCount: 8
        },
        deviceData: {
            batteryVoltage: 3.8,
            rssi: -69,
            extPower: true,
            extPowerVoltage: 12.8,
            deviceTemp: 34.6
        },
        reeferData: {
            hasReeferData: true,
            ambientTemp: 27.3,
            setTemp: -18,
            supplyTemp1: -20.1,
            returnTemp1: -16.8
        }
    }
];

// Function to get demo data formatted like API response
function getDemoData() {
    return {
        clientId: 'KAGU',
        assets: DEMO_ASSETS,
        summary: {
            totalExpected: 10,
            online: DEMO_ASSETS.filter(a => a.status === 'online').length,
            offline: DEMO_ASSETS.filter(a => a.status === 'offline').length,
            neverSeen: DEMO_ASSETS.filter(a => a.status === 'never_seen').length
        },
        timestamp: new Date().toISOString()
    };
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEMO_ASSETS, getDemoData };
}