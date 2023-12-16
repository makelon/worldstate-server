import { IncomingMessage } from 'http'
import { RequestOptions } from 'https'

import config from './config'
import { getDate } from './helpers'
import { getResponseData, prepareRequest, sendRequest } from './httphelpers'
import Kuvalog from './kuvalog'
import * as log from './log'
import { queue } from './promisify'

import AcolyteReader from './readers/acolytes'
import AlertReader from './readers/alerts'
import ArbitrationReader from './readers/arbitrations'
import BountieReader from './readers/bounties'
import ChallengeReader from './readers/challenges'
import DailyDealReader from './readers/dailydeals'
import DayNightReader from './readers/daynight'
import FactionProjectReader from './readers/factionprojects'
import FomorianReader from './readers/fomorians'
import InvasionReader from './readers/invasions'
import KuvaSiphonReader from './readers/kuvasiphons'
import NewsReader from './readers/news'
import SortieReader from './readers/sorties'
import UpgradeReader from './readers/upgrades'
import VoidFissureReader from './readers/voidfissures'
import VoidStormReader from './readers/voidstorms'
import VoidTraderReader from './readers/voidtraders'
import WfReader from './readers/reader'

interface WorldstateStruct {
	WorldSeed: string
	Time: number
	PersistentEnemies: AcolyteEntry[]
	Alerts: AlertEntry[]
	SeasonInfo: ChallengeSeasonEntry | Record<string, never>
	DailyDeals: DailyDealEntry[]
	ProjectPct: FactionProjectEntry
	Goals: GoalEntry[]
	Invasions: InvasionEntry[]
	Events: NewsEntry[]
	Tmp: string
	Sorties: SortieEntry[]
	SyndicateMissions: BountyEntry[]
	GlobalUpgrades: UpgradeEntry[]
	ActiveMissions: VoidFissureEntry[]
	VoidStorms: VoidStormEntry[]
	VoidTraders: VoidTraderEntry[]
}

type WfResponse = {
	[key in WfRecordKey]?: {
		time?: number
		data?: WfRecordType[]
	}
} & {
	time: number
	rewardtables: WfRewardTableMap
}

/**
 * Check whether the given data is likely to be worldstate data
 *
 * @param ws
 */
function looksLikeWorldstate(ws: WorldstateStruct): boolean {
	return 'WorldSeed' in ws
}

export default class Worldstate {
	private requestOptions: RequestOptions | null = null
	private requestTimerId?: NodeJS.Timeout
	private ws?: WorldstateStruct
	private now = 0
	private ready = false
	private retryTimeout = config.minRetryTimeout
	private nextUpdate = Date.now() + 3000
	private defer: { bounties: BountyEntry[] } = {
		bounties: [],
	}
	private kuvalog = Kuvalog.getInstance()
	private readers: Readonly<{ [T in WfRecordKey]: WfReader<WfRecordTypes[T]> }> = {
		'acolytes': new AcolyteReader(this.platform),
		'alerts': new AlertReader(this.platform),
		'arbitrations': new ArbitrationReader(this.platform),
		'bounties': new BountieReader(this.platform),
		'challenges': new ChallengeReader(this.platform),
		'dailydeals': new DailyDealReader(this.platform),
		'daynight': new DayNightReader(this.platform),
		'fissures': new VoidFissureReader(this.platform),
		'fomorians': new FomorianReader(this.platform),
		'factionprojects': new FactionProjectReader(this.platform),
		'invasions': new InvasionReader(this.platform),
		'kuvasiphons': new KuvaSiphonReader(this.platform),
		'news': new NewsReader(this.platform),
		'sorties': new SortieReader(this.platform),
		'upgrades': new UpgradeReader(this.platform),
		'voidstorms': new VoidStormReader(this.platform),
		'voidtraders': new VoidTraderReader(this.platform),
	}

	constructor(
		private db: WfDb,
		private platform: WfPlatform,
		private instanceDelay: number,
	) {
		log.notice('Creating worldstate instance %s', platform)
		this.kuvalog.onUpdate(() => { this.readKuvalog() })
	}

	/**
	 * Initialize database tables and schedule worldstate request when database is ready
	 */
	start(): void {
		this.db.setupTables(() => {
			this.initReaders()
			this.ready = true
			this.scheduleWorldstateRequest(this.instanceDelay)
			this.kuvalog.start()
		})
		this.setRequestOptions()
	}

	/**
	 * Re-read the most recent worldstate dump and update all known records
	 */
	reload(): void {
		this.setRequestOptions()
		this.db.setupTables(() => {
			this.kuvalog.reload()
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
			this.readers[readerId as WfRecordKey].start(this.db)
		}
	}

	/**
	 * Initialize request options object
	 */
	private setRequestOptions(): void {
		try {
			const url = config.wsUrls[this.platform]
			this.requestOptions = url
				? prepareRequest(url)
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
		if (types[0] === 'worldstate') {
			// Raw worldstate dump
			return JSON.stringify(this.ws || {})
		}
		const ret: WfResponse = {
			time: this.now,
			rewardtables: {},
		}
		for (const type of types as WfRecordKey[]) {
			if (!(type in this.readers)) {
				log.debug('"%s" is not a valid worldstate category', type)
				continue
			}
			const reader = this.readers[type],
				readerData = reader.getData(this.now)
			if (readerData) {
				log.debug('Sending %s', type)
				ret[type] = readerData
				const entityRewards = reader.entityRewards
				for (const entityName in entityRewards) {
					ret.rewardtables[entityName] = entityRewards[entityName]
				}
			}
			else {
				log.debug('Database %s/%s is not ready', this.platform, type)
				ret[type] = {}
			}
		}
		return JSON.stringify(ret)
	}

	/**
	 * @returns Time when the next potential update happens
	 */
	getNextUpdate(): number {
		const nextKuvaUpdate = this.kuvalog.getNextUpdate()
		return nextKuvaUpdate ? Math.min(this.nextUpdate, nextKuvaUpdate) : this.nextUpdate
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

		const req = sendRequest(this.requestOptions)
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
	private handleWorldstateResponse(res: IncomingMessage): void {
		getResponseData(res)
			.then(resData => {
				let resParsed: WorldstateStruct
				try {
					resParsed = JSON.parse(resData)
				}
				catch (err) {
					throw new Error(`Failed to parse response: ${err.message}`)
				}
				if (!looksLikeWorldstate(resParsed)) {
					const resHead = resData.length > 210 ? resData.slice(0, 200) + '...' : resData
					throw new Error(`Response does not look like worldstate data: '${resHead}'`)
				}
				const timestamp = getDate(resParsed)
				if (!timestamp) {
					throw new Error('Response does not have a timestamp')
				}
				this.ws = resParsed
				this.now = timestamp
				this.readWorldstate()
				this.retryTimeout = Math.max(config.minRetryTimeout, this.retryTimeout - 1500)
				this.scheduleWorldstateRequest(config.updateInterval)
			}).catch((err: Error) => { this.retryRequestWorldstate(res.complete ? res.statusCode : 0, err.message) })
	}

	/**
	 * Parse the worldstate dump using a chain of Promises to minimize blocking
	 */
	private readWorldstate(): void {
		queue(
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
			this.readVoidStorms,
			this.readVoidTraders,
			this.flushDb,
		).catch(err => { log.error('Error reading worldstate: %s', err.message) })
	}

	private readAcolytes(): void {
		let acolytes = this.ws?.PersistentEnemies
		if (!Array.isArray(acolytes)) {
			acolytes = []
		}
		try {
			this.readers['acolytes'].read(acolytes, this.now)
		}
		catch (err) {
			log.error('Error reading acolytes for %s: %s', this.platform, err.message)
		}
	}

	private readAlerts(): void {
		let alerts = this.ws?.Alerts
		if (!Array.isArray(alerts)) {
			alerts = []
		}
		try {
			this.readers['alerts'].read(alerts, this.now)
		}
		catch (err) {
			log.error('Error reading alerts for %s: %s', this.platform, err.message)
		}
	}

	private readChallenges(): void {
		let challengeSeasons = this.ws?.SeasonInfo
		if (!challengeSeasons) {
			challengeSeasons = {}
		}
		try {
			this.readers['challenges'].read(challengeSeasons, this.now)
		}
		catch (err) {
			log.error('Error reading challenges for %s: %s', this.platform, err.message)
		}
	}

	private readDailyDeals(): void {
		let deals = this.ws?.DailyDeals
		if (!Array.isArray(deals)) {
			deals = []
		}
		try {
			this.readers['dailydeals'].read(deals, this.now)
		}
		catch (err) {
			log.error('Error reading dailydeals for %s: %s', this.platform, err.message)
		}
	}

	private readFactionProjects(): void {
		let projects = this.ws?.ProjectPct
		if (!Array.isArray(projects)) {
			projects = []
		}
		try {
			this.readers['factionprojects'].read(projects, this.now)
		}
		catch (err) {
			log.error('Error reading faction projects for %s: %s', this.platform, err.message)
		}
	}

	/**
	 * Read goals
	 * The goals category is a "misc bin". Determine type and hand off to relevant function
	 * Both the Razorback and Balor Fomorian are found in this section
	 */
	private readGoals(): void {
		log.notice('Reading %s goals', this.platform)
		let goals = this.ws?.Goals
		if (!Array.isArray(goals)) {
			goals = []
		}
		const fomorians: GoalEntry[] = []
		for (const goal of goals) {
			if (goal.Fomorian) {
				fomorians.push(goal)
			}
			else if (goal.Jobs && goal.Tag && ['GhoulEmergence', 'InfestedPlains'].indexOf(goal.Tag) > -1) {
				this.defer.bounties.push(goal)
			}
		}
		try {
			this.readers['fomorians'].read(fomorians, this.now)
		}
		catch (err) {
			log.error('Error reading fomorians for %s: %s', this.platform, err.message)
		}
	}

	private readInvasions(): void {
		let invasions = this.ws?.Invasions
		if (!Array.isArray(invasions)) {
			invasions = []
		}
		try {
			this.readers['invasions'].read(invasions, this.now)
		}
		catch (err) {
			log.error('Error reading invasions for %s: %s', this.platform, err.message)
		}
	}

	/**
	 * Kuvalog is a third party data source that provides information about arbitration and kuva missions
	 */
	private readKuvalog(): void {
		try {
			this.readers['arbitrations'].read(this.kuvalog.arbitrations, this.kuvalog.getLastUpdate())
		}
		catch (err) {
			log.error('Error reading arbitrations for %s: %s', this.platform, err.message)
		}
		try {
			this.readers['kuvasiphons'].read(this.kuvalog.kuvamissions, this.kuvalog.getLastUpdate())
		}
		catch (err) {
			log.error('Error reading kuvasiphons for %s: %s', this.platform, err.message)
		}
	}

	/**
	 * Events and tactical alerts are found in the Goals section
	 */
	private readNews(): void {
		let articles = this.ws?.Events
		if (!Array.isArray(articles)) {
			articles = []
		}
		try {
			this.readers['news'].read(articles, this.now)
		}
		catch (err) {
			log.error('Error reading news for %s: %s', this.platform, err.message)
		}
	}

	private readSorties(): void {
		let sorties = this.ws?.Sorties
		if (!Array.isArray(sorties)) {
			sorties = []
		}
		try {
			this.readers['sorties'].read(sorties, this.now)
		}
		catch (err) {
			log.error('Error reading sorties for %s: %s', this.platform, err.message)
		}
	}

	/**
	 * Syndicate missions and Bounties are found under the same key
	 */
	private readSyndicateMissions(): void {
		log.notice('Reading %s syndicate missions', this.platform)
		const bounties = this.defer.bounties.splice(0) // Clear deferred bounties
		if (this.ws?.SyndicateMissions && this.ws.SyndicateMissions[0]) {
			for (const missions of this.ws.SyndicateMissions) {
				if (missions.Jobs) {
					bounties.push(missions)
				}
			}
		}
		try {
			this.readers['bounties'].read(bounties, this.now)
		}
		catch (err) {
			log.error('Error reading bounties for %s: %s', this.platform, err.message)
		}
	}

	/**
	 * Read global modifiers, which includes boosters
	 */
	private readUpgrades(): void {
		let upgrades = this.ws?.GlobalUpgrades
		if (!Array.isArray(upgrades)) {
			upgrades = []
		}
		try {
			this.readers['upgrades'].read(upgrades, this.now)
		}
		catch (err) {
			log.error('Error reading upgrades for %s: %s', this.platform, err.message)
		}
	}

	private readVoidFissures(): void {
		let fissures = this.ws?.ActiveMissions
		if (!Array.isArray(fissures)) {
			fissures = []
		}
		try {
			this.readers['fissures'].read(fissures, this.now)
		}
		catch (err) {
			log.error('Error reading void fissures for %s: %s', this.platform, err.message)
		}
	}

	private readVoidStorms(): void {
		let voidstorms = this.ws?.VoidStorms
		if (!Array.isArray(voidstorms)) {
			voidstorms = []
		}
		try {
			this.readers['voidstorms'].read(voidstorms, this.now)
		}
		catch (err) {
			log.error('Error reading void storms for %s: %s', this.platform, err.message)
		}
	}

	private readVoidTraders(): void {
		let voidTraders = this.ws?.VoidTraders
		if (!Array.isArray(voidTraders)) {
			voidTraders = []
		}
		try {
			this.readers['voidtraders'].read(voidTraders, this.now)
		}
		catch (err) {
			log.error('Error reading void traders for %s: %s', this.platform, err.message)
		}
	}

	/**
	 * Write all database changes to disk
	 */
	private flushDb(): void {
		this.db.flush()
	}
}
