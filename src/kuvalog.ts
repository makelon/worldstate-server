import http = require('http')
import https = require('https')
import EventEmitter = require('events')
import log = require('./log')
import h = require('./helpers')
import config from './config'
import httpHelper = require('./httphelper')

function looksLikeKuvalog(kuvalog: any) {
	return Array.isArray(kuvalog) && kuvalog[0] && kuvalog[0].hasOwnProperty('missiontype')
}

export default class Kuvalog {
	private requestOptions: https.RequestOptions | null = null
	private requestTimerId?: NodeJS.Timer
	private _arbitrations: any[] = []
	private _kuvamissions: any[] = []
	private retryTimeout = config.minRetryTimeout
	private lastUpdate = 0
	private nextUpdate = 0
	private ee = new EventEmitter()

	constructor(
		private platform: string,
		private instanceDelay: number,
	) {
		log.notice('Creating kuvalog instance %s', platform)
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
				? httpHelper.prepareRequest(url)
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

		const req = httpHelper.sendRequest(this.requestOptions)
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
	private handleKuvalogResponse(res: http.IncomingMessage): void {
		httpHelper.getResponseData(res)
			.then(resData => {
				let resParsed: any
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
						lastArbitrationStart = Math.max(lastArbitrationStart, h.strToTime(mission.start))
					}
					else if (mission.missiontype.startsWith('KuvaMission')) {
						lastKuvaSiphonStart = Math.max(lastKuvaSiphonStart, h.strToTime(mission.start))
					}
				}
				const responseAge = h.getCurrentTime() - Math.min(lastArbitrationStart, lastKuvaSiphonStart)
				this.scheduleKuvalogRequest(responseAge >= 3600 ? 60000 : 1000 * (3700 - responseAge))
				this.retryTimeout = Math.max(config.minRetryTimeout, this.retryTimeout - 1500)
				this.readKuvalog(resParsed)
			}).catch((err: Error) => { this.retryRequestKuvalog(res.complete ? res.statusCode : 0, err.message) })
	}

	/**
	 * Update the lists of kuva and arbitration missions
	 */
	private readKuvalog(input: any[]): void {
		this._arbitrations = []
		this._kuvamissions = []
		this.lastUpdate = h.getCurrentTime()
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

	get arbitrations() { return this._arbitrations }

	get kuvamissions() { return this._kuvamissions }
}
