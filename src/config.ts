import fs = require('fs')
import log = require('./log')

const defaults = {
	logLevel: 'info', // debug, notice, info, warning, error
	dbRoot: '', // Where to store the database files. Storage is disabled if this value is empty
	wsFields: [ // Components to parse
		'news',
		'alerts',
		'events',
		'fomorians',
		'sorties',
		'invasions',
		'fissures',
		'bounties',
		'factionprojects',
		'voidtraders',
		'acolytes',
		'dailydeals',
		'upgrades',
		'daynight'
	],
	wsUrls: { // Worldstate endpoints
		'pc': 'http://content.warframe.com/dynamic/worldState.php',
		'ps4': 'http://content.ps4.warframe.com/dynamic/worldState.php',
		'xb1': 'http://content.xb1.warframe.com/dynamic/worldState.php',
	},
	dayNightPath: './daynight.json',
	minRetryTimeout: 10000,
	maxRetryTimeout: 120000,
	requestTimeout: 30000,
	updateInterval: 180000,
	instanceDelay: 10000, // Time to wait between platform requests on startup
	enableConsoleTime: true, // Enable timestamps in console output
	enableDbWrites: true, // Enable persistent storage
	listen: 0, // <port number> | <interface address>:<port number> | socket path
	userAgent: 'Warframe Worldstate v1.0 for Node.js',
	cors: '', // Value for the Access-Control-Allow-Origin header

	// TLS config used by worldstate requests
	tlsCa: '', // Trusted root certificates in PEM format. Mostly for testing against development servers on HTTPS
	tlsVerify: true, // Check validity of certificate when requesting worldstate from HTTPS host
}

class WfConfig {
	logLevel!: string
	dbRoot!: string
	wsFields!: ReadonlyArray<string>
	wsUrls!: WfMap
	dayNightPath!: string
	minRetryTimeout!: number
	maxRetryTimeout!: number
	requestTimeout!: number
	updateInterval!: number
	instanceDelay!: number
	enableConsoleTime!: boolean
	enableDbWrites!: boolean
	listen!: number | string
	userAgent!: string
	cors!: string
	tlsCa!: string
	tlsVerify!: boolean

	load(configPath: string): void {
		let overrides: any = {}
		try {
			overrides = JSON.parse(fs.readFileSync(configPath, 'utf8'))
		}
		catch (err) {
			if (err.code == 'ENOENT') {
				log.warning('Cannot open config.json. Using defaults')
			}
			else {
				log.error(err.message)
				process.exit(1)
			}
		}
		if (overrides.wsUrls) {
			const wsUrls = overrides.wsUrls
			this.wsUrls = {}
			if ('pc' in wsUrls) this.wsUrls.pc = wsUrls.pc
			if ('ps4' in wsUrls) this.wsUrls.ps4 = wsUrls.ps4
			if ('xb1' in wsUrls) this.wsUrls.xb1 = wsUrls.xb1
		}
		else {
			this.wsUrls = defaults.wsUrls
		}
		this.dayNightPath = ('dayNightPath' in overrides) ? overrides.dayNightPath : defaults.dayNightPath
		this.logLevel = ('logLevel' in overrides) ? overrides.logLevel : defaults.logLevel
		this.dbRoot = ('dbRoot' in overrides) ? overrides.dbRoot : defaults.dbRoot
		this.wsFields = ('wsFields' in overrides) ? overrides.wsFields : defaults.wsFields
		this.minRetryTimeout = ('minRetryTimeout' in overrides) ? overrides.minRetryTimeout : defaults.minRetryTimeout
		this.maxRetryTimeout = ('maxRetryTimeout' in overrides) ? overrides.maxRetryTimeout : defaults.maxRetryTimeout
		this.requestTimeout = ('requestTimeout' in overrides) ? overrides.requestTimeout : defaults.requestTimeout
		this.updateInterval = ('updateInterval' in overrides) ? overrides.updateInterval : defaults.updateInterval
		this.instanceDelay = ('instanceDelay' in overrides) ? overrides.instanceDelay : defaults.instanceDelay
		this.enableConsoleTime = ('enableConsoleTime' in overrides) ? overrides.enableConsoleTime : defaults.enableConsoleTime
		this.enableDbWrites = ('enableDbWrites' in overrides) ? overrides.enableDbWrites : defaults.enableDbWrites
		this.listen = ('listen' in overrides) ? overrides.listen : defaults.listen
		this.userAgent = ('userAgent' in overrides) ? overrides.userAgent : defaults.userAgent
		this.cors = ('cors' in overrides) ? overrides.cors : defaults.cors
		this.tlsCa = ''
		if ('tlsCa' in overrides) {
			for (const ca of overrides.tlsCa) {
				this.tlsCa += fs.readFileSync(ca, 'ascii')
			}
		}
		this.tlsVerify = ('tlsVerify' in overrides) ? overrides.tlsVerify : defaults.tlsVerify
		if (!this.dbRoot) this.enableDbWrites = false
	}
}

const config = new WfConfig()
export default config
