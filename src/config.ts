import { readFileSync } from 'fs'

import * as log from './log.js'

interface WfConfigI {
	logLevel: string
	dbRoot: string
	wsFields: ReadonlyArray<WfRecordKey>
	wsUrl: string
	kuvalogUrl: string
	dayNightPath: string
	minRetryTimeout: number
	maxRetryTimeout: number
	requestTimeout: number
	updateInterval: number
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
		'sorties',
		'upgrades',
		'voidstorms',
		'voidtraders',
	],
	wsUrl: 'https://content.warframe.com/dynamic/worldState.php', // Worldstate endpoint
	kuvalogUrl: '',
	dayNightPath: './daynight.json',
	minRetryTimeout: 10000,
	maxRetryTimeout: 120000,
	requestTimeout: 30000,
	updateInterval: 180000,
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
	wsUrl!: string
	kuvalogUrl!: string
	dayNightPath!: string
	minRetryTimeout!: number
	maxRetryTimeout!: number
	requestTimeout!: number
	updateInterval!: number
	enableConsoleTime!: boolean
	enableDbWrites!: boolean
	listen!: number | string
	userAgent!: string
	cors!: string
	tlsCa!: string
	tlsVerify!: boolean

	load(configPath: string): void {
		let overrides: Partial<WfConfigI>

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

		const configure = function<T extends keyof WfConfigI>(this: WfConfigI, name: T): void {
			this[name] = typeof overrides[name] === 'undefined'
				? defaults[name]
				: overrides[name] as WfConfigI[T]
		}.bind(this)

		configure('dayNightPath')
		configure('logLevel')
		configure('dbRoot')
		configure('wsFields')
		configure('wsUrl')
		configure('kuvalogUrl')
		configure('minRetryTimeout')
		configure('maxRetryTimeout')
		configure('requestTimeout')
		configure('updateInterval')
		configure('enableConsoleTime')
		configure('enableDbWrites')
		configure('listen')
		configure('userAgent')
		configure('cors')
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
		configure('tlsVerify')
		if (!this.dbRoot) {
			this.enableDbWrites = false
		}
	}
}

const config = new WfConfig()
export default config
