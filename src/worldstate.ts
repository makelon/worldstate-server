import { type IncomingMessage } from 'http'
import { type RequestOptions } from 'https'

import config from './config.js'
import { getDate } from './helpers.js'
import { getResponseData, prepareRequest, sendRequest } from './httphelpers.js'
import Kuvalog from './kuvalog.js'
import * as log from './log.js'
import { queue } from './promisify.js'

import AcolyteReader from './readers/acolytes.js'
import AlertReader from './readers/alerts.js'
import ArbitrationReader from './readers/arbitrations.js'
import BountieReader from './readers/bounties.js'
import ChallengeReader from './readers/challenges.js'
import DailyDealReader from './readers/dailydeals.js'
import DayNightReader from './readers/daynight.js'
import FactionProjectReader from './readers/factionprojects.js'
import FomorianReader from './readers/fomorians.js'
import InvasionReader from './readers/invasions.js'
import KuvaSiphonReader from './readers/kuvasiphons.js'
import NewsReader from './readers/news.js'
import SortieReader from './readers/sorties.js'
import UpgradeReader from './readers/upgrades.js'
import VoidFissureReader from './readers/voidfissures.js'
import VoidStormReader from './readers/voidstorms.js'
import VoidTraderReader from './readers/voidtraders.js'
import type WfReader from './readers/reader.js'

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
	private readers: Readonly<{ [T in WfRecordKey]: WfReader<WfRecordTypes[T]> }>

	constructor(private db: WfDb) {
		log.notice('Creating worldstate instance')
		this.kuvalog.onUpdate(() => { this.readKuvalog() })
		this.readers = {
			'acolytes': new AcolyteReader(),
			'alerts': new AlertReader(),
			'arbitrations': new ArbitrationReader(),
			'bounties': new BountieReader(),
			'challenges': new ChallengeReader(),
			'dailydeals': new DailyDealReader(),
			'daynight': new DayNightReader(),
			'fissures': new VoidFissureReader(),
			'fomorians': new FomorianReader(),
			'factionprojects': new FactionProjectReader(),
			'invasions': new InvasionReader(),
			'kuvasiphons': new KuvaSiphonReader(),
			'news': new NewsReader(),
			'sorties': new SortieReader(),
			'upgrades': new UpgradeReader(),
			'voidstorms': new VoidStormReader(),
			'voidtraders': new VoidTraderReader(),
		}
	}

	/**
	 * Initialize database tables and schedule worldstate request when database is ready
	 */
	start(): void {
		this.db.setupTables(() => {
			this.initReaders()
			this.ready = true
			this.scheduleWorldstateRequest(0)
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
				log.info('Reloading worldstate')
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
			this.requestOptions = config.wsUrl
				? prepareRequest(config.wsUrl)
				: null
		}
		catch(err) {
			log.error(err.message)
		}
	}

	/**
	 * Return the current data for the selected categories
	 *
	 * @param types Categories to fetch
	 * @returns JSON encoded worldstate data
	 */
	get(types?: string[]): string {
		if (!this.ready) {
			return JSON.stringify('Inactive worldstate instance')
		}
		types = types || config.wsFields.slice()
		log.debug('Fetching %s', types.join(', '))
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
				log.debug('Database table %s is not ready', type)
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
		log.error('worldstate request failed (%s)', message)
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
					const resHead = resData.length > 210 ? resData.substring(0, 200) + '...' : resData
					throw new Error(`Response does not look like worldstate data: '${resHead}'`)
				}
				const timestamp = getDate(resParsed)
				if (!timestamp) {
					throw new Error('Response does not have a timestamp')
				}
				if (timestamp < this.now) {
					throw new Error('Response is older than current worldstate')
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

	private simpleRead(entryKey: keyof WorldstateStruct, readerName: WfRecordKey): void {
		let entries = this.ws?.[entryKey]
		if (!Array.isArray(entries)) {
			entries = []
		}
		try {
			this.readers[readerName].read(entries, this.now)
		}
		catch (err) {
			log.error('Error reading %s: %s', readerName, err.message)
		}
	}

	private readAcolytes(): void {
		this.simpleRead('PersistentEnemies', 'acolytes')
	}

	private readAlerts(): void {
		this.simpleRead('Alerts', 'alerts')
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
			log.error('Error reading challenges: %s', err.message)
		}
	}

	private readDailyDeals(): void {
		this.simpleRead('DailyDeals', 'dailydeals')
	}

	private readFactionProjects(): void {
		this.simpleRead('ProjectPct', 'factionprojects')
	}

	/**
	 * Read goals
	 * The goals category is a "misc bin". Determine type and hand off to relevant function
	 * Both the Razorback and Balor Fomorian are found in this section
	 */
	private readGoals(): void {
		log.notice('Reading goals')
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
			this.readers.fomorians.read(fomorians, this.now)
		}
		catch (err) {
			log.error('Error reading fomorians: %s', err.message)
		}
	}

	private readInvasions(): void {
		this.simpleRead('Invasions', 'invasions')
	}

	/**
	 * Kuvalog is a third party data source that provides information about arbitration and kuva missions
	 */
	private readKuvalog(): void {
		try {
			this.readers.arbitrations.read(this.kuvalog.arbitrations, this.kuvalog.getLastUpdate())
		}
		catch (err) {
			log.error('Error reading arbitrations: %s', err.message)
		}
		try {
			this.readers.kuvasiphons.read(this.kuvalog.kuvamissions, this.kuvalog.getLastUpdate())
		}
		catch (err) {
			log.error('Error reading kuvasiphons: %s', err.message)
		}
	}

	/**
	 * Events and tactical alerts are found in the Goals section
	 */
	private readNews(): void {
		this.simpleRead('Events', 'news')
	}

	private readSorties(): void {
		this.simpleRead('Sorties', 'sorties')
	}

	/**
	 * Syndicate missions and Bounties are found under the same key
	 */
	private readSyndicateMissions(): void {
		log.notice('Reading syndicate missions')
		const bounties = this.defer.bounties.splice(0) // Clear deferred bounties
		if (this.ws?.SyndicateMissions && this.ws.SyndicateMissions[0]) {
			for (const missions of this.ws.SyndicateMissions) {
				if (missions.Jobs) {
					bounties.push(missions)
				}
			}
		}
		try {
			this.readers.bounties.read(bounties, this.now)
		}
		catch (err) {
			log.error('Error reading bounties: %s', err.message)
		}
	}

	/**
	 * Read global modifiers, which includes boosters
	 */
	private readUpgrades(): void {
		this.simpleRead('GlobalUpgrades', 'upgrades')
	}

	private readVoidFissures(): void {
		this.simpleRead('ActiveMissions', 'fissures')
	}

	private readVoidStorms(): void {
		this.simpleRead('VoidStorms', 'voidstorms')
	}

	private readVoidTraders(): void {
		this.simpleRead('VoidTraders', 'voidtraders')
	}

	/**
	 * Write all database changes to disk
	 */
	private flushDb(): void {
		this.db.flush()
	}
}
