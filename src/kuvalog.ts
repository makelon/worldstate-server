import { EventEmitter } from 'events'
import { type IncomingMessage } from 'http'
import { type RequestOptions } from 'https'

import config from './config.js'
import { getCurrentTime, strToTime } from './helpers.js'
import { getResponseData, prepareRequest, sendRequest } from './httphelpers.js'
import * as log from './log.js'

function looksLikeKuvalog(kuvalog: KuvalogEntry[]): boolean {
	return Array.isArray(kuvalog) && kuvalog[0] && 'missiontype' in kuvalog[0]
}

export default class Kuvalog {
	private requestOptions: RequestOptions | null = null
	private requestTimerId?: NodeJS.Timeout
	private _arbitrations: KuvalogEntry[] = []
	private _kuvamissions: KuvalogEntry[] = []
	private retryTimeout = config.minRetryTimeout
	private lastUpdate = 0
	private nextUpdate = 0
	private ee = new EventEmitter()
	private static instance?: Kuvalog

	private constructor(
		private platform: WfPlatform,
		private instanceDelay: number,
	) {
		log.notice('Creating kuvalog instance %s', platform)
	}

	static getInstance(): Kuvalog {
		if (!Kuvalog.instance) {
			Kuvalog.instance = new Kuvalog('pc', 0)
		}
		return Kuvalog.instance
	}

	/**
	 * Initialize database tables and schedule kuvalog request
	 */
	start(): void {
		this.setRequestOptions()
		this.scheduleKuvalogRequest(this.instanceDelay)
	}

	reload(): void {
		this.setRequestOptions()
		this.scheduleKuvalogRequest(0)
	}

	/**
	 * Set update handler
	 *
	 * @param updateHandler Function to call when kuvalog data is read
	 */
	onUpdate(updateHandler: () => void): void {
		this.ee.on('update', updateHandler)
	}

	/**
	 * Initialize request options object
	 */
	private setRequestOptions(): void {
		try {
			const url = config.kuvalogUrls[this.platform]
			this.requestOptions = url
				? prepareRequest(url)
				: null
		}
		catch(err) {
			log.error(err.message)
		}
	}

	/**
	 * @returns Time when the next potential update happens
	 */
	getNextUpdate(): number {
		return this.nextUpdate
	}

	/**
	 * Update or set timer for a kuvalog request
	 *
	 * @param delay Time to wait before sending the request
	 */
	private scheduleKuvalogRequest(delay: number): void {
		if (this.requestTimerId) {
			log.notice('Clearing kuvalog request timer')
			clearTimeout(this.requestTimerId)
		}
		this.requestTimerId = setTimeout(() => {
			this.requestTimerId = undefined
			this.requestKuvalog()
		}, delay)
		this.nextUpdate = Date.now() + delay
	}

	/**
	 * Send a kuvalog request
	 */
	private requestKuvalog(): void {
		if (!this.requestOptions) {
			// Clear old entries if request parameters are missing or invalid
			this.readKuvalog([])
			this.nextUpdate = 0
			return
		}
		log.notice('Requesting %s//%s%s', this.requestOptions.protocol, this.requestOptions.hostname, this.requestOptions.path)

		const req = sendRequest(this.requestOptions)
		req.setTimeout(config.requestTimeout)
			.once('response', res => { this.handleKuvalogResponse(res) })
			.once('error', err => { this.retryRequestKuvalog(0, err.message) })
	}

	/**
	 * Handle a failed kuvalog request and schedule a new attempt
	 *
	 * @param code HTTP status code or empty if request failed before the HTTP layer
	 * @param message Error message
	 */
	private retryRequestKuvalog(code?: number, message?: string): void {
		if (code) {
			message = `${code}: ${message}`
		}
		log.error('%s kuvalog request failed (%s)', this.platform, message)
		this.scheduleKuvalogRequest(this.retryTimeout)
		this.retryTimeout = Math.min(this.retryTimeout * 2, config.maxRetryTimeout)
	}

	/**
	 * Read kuvalog dump and schedule next request
	 * Start the parsing process if the dump passes validity tests
	 */
	private handleKuvalogResponse(res: IncomingMessage): void {
		getResponseData(res)
			.then(resData => {
				let resParsed: KuvalogEntry[]
				try {
					resParsed = JSON.parse(resData)
				}
				catch (err) {
					throw new Error(`Failed to parse response: ${err.message}`)
				}
				if (!looksLikeKuvalog(resParsed)) {
					const resHead = resData.length > 210 ? resData.slice(0, 200) + '...' : resData
					throw new Error(`Response does not look like kuvalog data: '${resHead}'`)
				}
				let lastArbitrationStart = 0,
					lastKuvaSiphonStart = 0
				for (const mission of resParsed) {
					if (mission.missiontype === 'EliteAlertMission') {
						lastArbitrationStart = Math.max(lastArbitrationStart, strToTime(mission.start))
					}
					else if (mission.missiontype.startsWith('KuvaMission')) {
						lastKuvaSiphonStart = Math.max(lastKuvaSiphonStart, strToTime(mission.start))
					}
				}
				const responseAge = getCurrentTime() - Math.min(lastArbitrationStart, lastKuvaSiphonStart)
				this.scheduleKuvalogRequest(responseAge >= 3600 ? 60000 : 1000 * (3700 - responseAge))
				this.retryTimeout = Math.max(config.minRetryTimeout, this.retryTimeout - 1500)
				this.readKuvalog(resParsed)
			}).catch((err: Error) => { this.retryRequestKuvalog(res.complete ? res.statusCode : 0, err.message) })
	}

	/**
	 * Update the lists of kuva and arbitration missions
	 */
	private readKuvalog(input: KuvalogEntry[]): void {
		this._arbitrations = []
		this._kuvamissions = []
		this.lastUpdate = getCurrentTime()
		for (const mission of input) {
			if (mission.missiontype === 'EliteAlertMission') {
				this._arbitrations.push(mission)
			}
			else if (mission.missiontype.startsWith('KuvaMission')) {
				this._kuvamissions.push(mission)
			}
		}
		this.ee.emit('update')
	}

	getLastUpdate(): number {
		return this.lastUpdate
	}

	get arbitrations(): KuvalogEntry[] { return this._arbitrations }

	get kuvamissions(): KuvalogEntry[] { return this._kuvamissions }
}
