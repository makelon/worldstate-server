import http = require('http')
import https = require('https')
import zlib = require('zlib')
import log = require('./log')
import h = require('./helpers')
import promisify = require('./promisify')
import config from './config'
import httpHelper = require('./httphelper')

import AcolyteReader from './readers/acolytes'
import AlertReader from './readers/alerts'
import BountieReader from './readers/bounties'
import ChallengeReader from './readers/challenges'
import DailyDealReader from './readers/dailydeals'
import DayNightReader from './readers/daynight'
import FactionProjectReader from './readers/factionprojects'
import FomorianReader from './readers/fomorians'
import InvasionReader from './readers/invasions'
import NewsReader from './readers/news'
import SortieReader from './readers/sorties'
import UpgradeReader from './readers/upgrades'
import VoidFissureReader from './readers/voidfissures'
import VoidTraderReader from './readers/voidtraders'

/**
 * Check whether the given data is likely to be worldstate data
 *
 * @param ws
 */
function looksLikeWorldstate(ws: any) {
	return ws.hasOwnProperty('WorldSeed')
}

/**
 * Counter used with <config.instanceDelay> to start each instance at the specified time
 */
let numInstances = 0

export default class Worldstate {
	private requestOptions: https.RequestOptions | null = null
	private requestTimerId?: NodeJS.Timer
	private ws: any
	private now = 0
	private ready = false
	private retryTimeout = config.minRetryTimeout
	private nextUpdate = Date.now() + 3000
	private defer: { [type: string]: any[] } = {
		bounties: []
	}
	private readers: { [readerId: string]: WfReader } = {
		acolytes: new AcolyteReader(this.platform),
		alerts: new AlertReader(this.platform),
		bounties: new BountieReader(this.platform),
		dailydeals: new DailyDealReader(this.platform),
		fissures: new VoidFissureReader(this.platform),
		factionprojects: new FactionProjectReader(this.platform),
		invasions: new InvasionReader(this.platform),
		fomorians: new FomorianReader(this.platform),
		news: new NewsReader(this.platform),
		sorties: new SortieReader(this.platform),
		upgrades: new UpgradeReader(this.platform),
		voidtraders: new VoidTraderReader(this.platform),
		daynight: new DayNightReader(this.platform),
		challenges: new ChallengeReader(this.platform)
	}

	constructor(
		private db: WfDb,
		private platform: string
	) {
		log.notice('Creating instance %s', platform)
	}

	/**
	 * Initialize database tables and schedule worldstate request when database is ready
	 */
	start(): void {
		this.db.setupTables(() => {
			this.initReaders()
			this.ready = true
			this.scheduleWorldstateRequest(config.instanceDelay * numInstances)
			++numInstances
		})
		this.setRequestOptions()
	}

	/**
	 * Re-read the most recent worldstate dump and update all known records
	 */
	reload(): void {
		this.setRequestOptions()
		this.db.setupTables(() => {
			if (this.ws) {
				log.info('Reloading %s worldstate', this.platform)
				this.initReaders()
				this.readWorldstate()
			}
		})
	}

	/**
	 * Instruct readers to set up database tables
	 */
	private initReaders(): void {
		for (const readerId in this.readers) {
			this.readers[readerId].start(this.db)
		}
	}

	/**
	 * Initialize request options object
	 */
	private setRequestOptions(): void {
		try {
			const url = config.wsUrls[this.platform]
			this.requestOptions = url
				? httpHelper.prepareRequest(url)
				: null
		}
		catch(err) {
			log.error(err.message)
		}
	}

	/**
	 * Return requested content from this instance
	 *
	 * @param types Instances to fetch data from
	 * @returns JSON encoded instance data
	 */
	get(types?: string[]): string {
		if (!this.ready) {
			return JSON.stringify('Inactive worldstate instance')
		}
		types = types || config.wsFields.slice()
		log.debug('Fetching %s for %s', types.join(', '), this.platform)
		if (types[0] == 'worldstate') {
			// Raw worldstate dump
			return JSON.stringify(this.ws || {})
		}
		const ret: {
			[key: string]: any
			time: number
			rewardtables: WfRewardTableMap
		} = {
			time: this.now,
			rewardtables: {}
		}
		for (const type of types) {
			// Timestamped database content
			const table = this.db.getTable(type)
			if (!table || !(type in this.readers)) {
				log.debug('"%s" is not a valid worldstate category', type)
			}
			else if (table.isReady()) {
				log.debug('Sending %s', type)
				ret[type] = {
					time: table.getLastUpdate(),
					data: table.getAll()
				}
				const entityRewards = this.readers[type].entityRewards
				for (const entityName in entityRewards) {
					ret.rewardtables[entityName] = entityRewards[entityName]
				}
			}
			else {
				ret[type] = {}
				log.debug('Database %s/%s is not ready', this.platform, type)
			}
		}
		return JSON.stringify(ret)
	}

	/**
	 * @returns Milliseconds until next worldstate request
	 */
	getNextUpdate(): number {
		return this.nextUpdate - Date.now()
	}

	/**
	 * Update or set timer for a worldstate request
	 *
	 * @param delay Time to wait before sending the request
	 */
	private scheduleWorldstateRequest(delay: number): void {
		if (this.requestTimerId) {
			log.notice('Clearing request timer')
			clearTimeout(this.requestTimerId)
		}
		this.requestTimerId = setTimeout(() => {
			this.requestTimerId = undefined
			this.requestWorldstate()
		}, delay)
		this.nextUpdate = Date.now() + delay
	}

	/**
	 * Send a worldstate request
	 */
	private requestWorldstate(): void {
		if (!this.requestOptions) {
			return
		}
		log.notice('Requesting %s//%s%s', this.requestOptions.protocol, this.requestOptions.hostname, this.requestOptions.path)

		const req = httpHelper.sendRequest(this.requestOptions)
		req.setTimeout(config.requestTimeout)
			.once('response', res => { this.handleWorldstateResponse(res) })
			.once('error', err => { this.retryRequestWorldstate(0, err.message) })
	}

	/**
	 * Handle a failed worldstate request and schedule a new attempt
	 *
	 * @param code HTTP status code or empty if request failed before the HTTP layer
	 * @param message Error message
	 */
	private retryRequestWorldstate(code?: number, message?: string): void {
		if (code) {
			message = `${code}: ${message}`
		}
		log.error('%s worldstate request failed (%s)', this.platform, message)
		this.scheduleWorldstateRequest(this.retryTimeout)
		this.retryTimeout = Math.min(this.retryTimeout * 2, config.maxRetryTimeout)
	}

	/**
	 * Read worldstate dump and schedule next request
	 * Start the parsing process if the dump passes validity tests
	 */
	private handleWorldstateResponse(res: http.IncomingMessage): void {
		let decomp,
			resData = ''
		switch (res.headers['content-encoding']) {
			case 'gzip':
				decomp = zlib.createGunzip()
				break
			case 'deflate':
				decomp = zlib.createInflate()
				break
		}
		const resStream = decomp ? res.pipe(decomp) : res
		resStream.setEncoding('utf8')
			.on('error', (err: Error) => { this.retryRequestWorldstate(0, err.message) })
			.on('data', (data: string) => { resData += data })
			.on('end', () => {
				try {
					const resParsed = JSON.parse(resData)
					if (res.statusCode != 200) {
						throw new Error(`HTTP error ${res.statusCode}: ${resParsed || resData}`)
					}
					if (!looksLikeWorldstate(resParsed)) {
						const resHead = resData.length > 210 ? resData.slice(0, 200) + '...' : resData
						throw new Error(`Response does not look like worldstate data: '${resHead}'`)
					}
					const timestamp = h.getDate(resParsed)
					if (!timestamp) {
						throw new Error('Response does not have a timestamp')
					}
					this.ws = resParsed
					this.now = timestamp
				}
				catch (err) {
					this.retryRequestWorldstate(res.statusCode, err.message)
					return
				}
				this.readWorldstate()
				this.retryTimeout = Math.max(config.minRetryTimeout, this.retryTimeout - 1500)
				this.scheduleWorldstateRequest(config.updateInterval)
			})
	}

	/**
	 * Parse the worldstate dump using a chain of Promises to minimize blocking
	 */
	private readWorldstate(): void {
		promisify.queue(
			this,
			this.readAcolytes,
			this.readAlerts,
			this.readChallenges,
			this.readDailyDeals,
			this.readFactionProjects,
			this.readGoals,
			this.readInvasions,
			this.readNews,
			this.readSorties,
			this.readSyndicateMissions,
			this.readUpgrades,
			this.readVoidFissures,
			this.readVoidTraders,
			this.flushDb
		).catch(err => { log.error('Error reading worldstate: %s', err.message) })
	}

	/**
	 * Read acolytes
	 */
	private readAcolytes(): void {
		let acolytes = this.ws.PersistentEnemies
		if (!acolytes || !acolytes[0]) {
			acolytes = []
		}
		this.readers['acolytes'].read(acolytes, this.now)
	}

	/**
	 * Read alerts
	 */
	private readAlerts(): void {
		let alerts = this.ws.Alerts
		if (!alerts || !alerts[0]) {
			alerts = []
		}
		this.readers['alerts'].read(alerts, this.now)
	}

	/**
	 * Read challenges
	 */
	private readChallenges(): void {
		let challengeSeasons = this.ws.SeasonInfo
		if (!challengeSeasons) {
			challengeSeasons = {}
		}
		this.readers['challenges'].read(challengeSeasons, this.now)
	}

	/**
	 * Read Darvo's daily deals
	 */
	private readDailyDeals(): void {
		let deals = this.ws.DailyDeals
		if (!deals || !deals[0]) {
			deals = []
		}
		this.readers['dailydeals'].read(deals, this.now)
	}

	/**
	 * Read faction projects
	 */
	private readFactionProjects(): void {
		let projects = this.ws.ProjectPct
		if (!projects || !projects[0]) {
			projects = []
		}
		this.readers['factionprojects'].read(projects, this.now)
	}

	/**
	 * Read goals
	 * The goals category is a "misc bin". Determine type and hand off to relevant function
	 * Both the Razorback and Balor Fomorian are found in this section
	 */
	private readGoals(): void {
		if (!this.ws.Goals) {
			return
		}
		log.notice('Reading %s goals', this.platform)
		let goals = this.ws.Goals
		if (!goals[0]) {
			goals = []
		}
		const fomorians = []
		for (const goal of goals) {
			if (goal.Fomorian) {
				fomorians.push(goal)
			}
			else if (goal.Jobs && ['GhoulEmergence', 'InfestedPlains'].indexOf(goal.Tag) > -1) {
				this.defer.bounties.push(goal)
			}
		}
		this.readers['fomorians'].read(fomorians, this.now)
	}

	/**
	 * Read invasions
	 */
	private readInvasions(): void {
		let invasions = this.ws.Invasions
		if (!invasions || !invasions[0]) {
			invasions = []
		}
		this.readers['invasions'].read(invasions, this.now)
	}

	/**
	 * Read news articles
	 * Events and tactical alerts are found in the Goals section
	 */
	private readNews(): void {
		let articles = this.ws.Events
		if (!articles || !articles[0]) {
			articles = []
		}
		this.readers['news'].read(articles, this.now)
	}

	/**
	 * Read sorties
	 */
	private readSorties(): void {
		let sorties = this.ws.Sorties
		if (!sorties || !sorties[0]) {
			sorties = []
		}
		this.readers['sorties'].read(sorties, this.now)
	}

	/**
	 * Read syndicate missions
	 * Syndicate missions and Bounties are found under the same key
	 */
	private readSyndicateMissions(): void {
		log.notice('Reading %s syndicate missions', this.platform)
		const bounties = this.defer.bounties.splice(0) // Clear deferred bounties
		if (this.ws.SyndicateMissions && this.ws.SyndicateMissions[0]) {
			for (const missions of this.ws.SyndicateMissions) {
				if (missions.Jobs) {
					bounties.push(missions)
				}
			}
		}
		this.readers['bounties'].read(bounties, this.now)
	}

	/**
	 * Read global boosters
	 */
	private readUpgrades(): void {
		let upgrades = this.ws.GlobalUpgrades
		if (!upgrades || !upgrades[0]) {
			upgrades = []
		}
		this.readers['upgrades'].read(upgrades, this.now)
	}

	/**
	 * Read void fissures
	 */
	private readVoidFissures(): void {
		let fissures = this.ws.ActiveMissions
		if (!fissures || !fissures[0]) {
			fissures = []
		}
		this.readers['fissures'].read(fissures, this.now)
	}

	/**
	 * Read void traders
	 */
	private readVoidTraders(): void {
		let voidTraders = this.ws.VoidTraders
		if (!voidTraders || !voidTraders[0]) {
			voidTraders = []
		}
		this.readers['voidtraders'].read(voidTraders, this.now)
	}

	/**
	 * Write all database changes to disk
	 */
	private flushDb(): void {
		this.db.flush()
	}
}
