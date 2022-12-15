import { readFileSync } from 'fs'

import * as log from './log'

interface WfConfigI {
	logLevel: string
	dbRoot: string
	wsFields: ReadonlyArray<WfRecordKey>
	wsUrls: WfMap<WfPlatform, string>
	kuvalogUrls: WfMap<WfPlatform, string>
	dayNightPath: string
	minRetryTimeout: number
	maxRetryTimeout: number
	requestTimeout: number
	updateInterval: number
	instanceDelay: number
	enableConsoleTime: boolean
	enableDbWrites: boolean
	listen: number | string
	userAgent: string
	cors: string
	tlsCa: string
	tlsVerify: boolean
}

const defaults: WfConfigI = {
	logLevel: 'info', // debug, notice, info, warning, error
	dbRoot: '', // Where to store the database files. Storage is disabled if this value is empty
	wsFields: [ // Components to parse
		'acolytes',
		'alerts',
		'arbitrations',
		'bounties',
		'challenges',
		'dailydeals',
		'daynight',
		'factionprojects',
		'fissures',
		'fomorians',
		'invasions',
		'kuvasiphons',
		'news',
		'sentient-anomalies',
		'sorties',
		'upgrades',
		'voidstorms',
		'voidtraders',
	],
	wsUrls: { // Worldstate endpoints
		pc: 'http://content.warframe.com/dynamic/worldState.php',
		ps4: 'http://content.ps4.warframe.com/dynamic/worldState.php',
		xb1: 'http://content.xb1.warframe.com/dynamic/worldState.php',
		ns: 'http://content.swi.warframe.com/dynamic/worldState.php',
	},
	kuvalogUrls: {
		pc: '',
		ps4: '',
		xb1: '',
		ns: '',
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

class WfConfig implements WfConfigI {
	logLevel!: string
	dbRoot!: string
	wsFields!: ReadonlyArray<WfRecordKey>
	wsUrls!: WfMap<WfPlatform, string>
	kuvalogUrls!: WfMap<WfPlatform, string>
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
		let overrides: Partial<WfConfigI>

		function getValue<T extends keyof WfConfigI>(name: T): WfConfigI[T] {
			return typeof overrides[name] === 'undefined'
				? defaults[name]
				: overrides[name] as WfConfigI[T]
		}

		try {
			const tmp: unknown = JSON.parse(readFileSync(configPath, 'utf8'))
			if (typeof tmp !== 'object' || tmp === null) {
				throw new Error('Failed to parse config.json')
			}
			overrides = tmp
		}
		catch (err) {
			if (err.code === 'ENOENT') {
				log.warning('Cannot open config.json. Using defaults')
				overrides = {}
			}
			else {
				log.error(err.message)
				process.exit(1)
			}
		}
		for (const urlType of ['wsUrls', 'kuvalogUrls'] as const) {
			if (overrides[urlType]) {
				const urls = overrides[urlType] || {}
				this[urlType] = {}
				for (const platform in defaults[urlType]) {
					if (platform in urls) {
						this[urlType][platform as WfPlatform] = urls[platform as WfPlatform]
					}
				}
			}
			else {
				this[urlType] = defaults[urlType]
			}
		}

		this.dayNightPath = getValue('dayNightPath')
		this.logLevel = getValue('logLevel')
		this.dbRoot = getValue('dbRoot')
		this.wsFields = getValue('wsFields')
		this.minRetryTimeout = getValue('minRetryTimeout')
		this.maxRetryTimeout = getValue('maxRetryTimeout')
		this.requestTimeout = getValue('requestTimeout')
		this.updateInterval = getValue('updateInterval')
		this.instanceDelay = getValue('instanceDelay')
		this.enableConsoleTime = getValue('enableConsoleTime')
		this.enableDbWrites = getValue('enableDbWrites')
		this.listen = getValue('listen')
		this.userAgent = getValue('userAgent')
		this.cors = getValue('cors')
		this.tlsCa = ''
		if (overrides.tlsCa) {
			for (const ca of overrides.tlsCa) {
				try {
					this.tlsCa += readFileSync(ca, 'ascii')
				}
				catch (err) {
					log.warning('Failed to open certificate database: ' + err.message)
				}
			}
		}
		this.tlsVerify = getValue('tlsVerify')
		if (!this.dbRoot) {
			this.enableDbWrites = false
		}
	}
}

const config = new WfConfig()
export default config
