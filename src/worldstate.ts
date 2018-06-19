import http = require('http')
import https = require('https')
import zlib = require('zlib')
import log = require('./log')
import tags = require('./tags')
import h = require('./helpers')
import items = require('./items')
import promisify = require('./promisify')
import Database from './db'
import config from './config'
import httpHelper = require('./httphelper');

function looksLikeWorldstate(ws: any) {
	return ws.hasOwnProperty('WorldSeed')
}

// Counter used with <config.instanceDelay> to start each instance at the specified time
let numInstances = 0

export default class Worldstate {
	private db: Database
	private platform: string
	private requestOptions: https.RequestOptions | null = null
	private requestTimerId?: NodeJS.Timer
	private ws: any
	private now: number = 0
	private ready: boolean = false
	private reloading: boolean = false
	private retryTimeout: number = config.minRetryTimeout
	private nextUpdate: number = Date.now() + 3000

	constructor(platform: string) {
		log.notice('Creating instance %s', platform)
		this.platform = platform
		this.db = new Database(this.platform)
	}

	start(): void {
		this.db.setupTables(() => {
			this.ready = true
			this.scheduleWorldstateRequest(config.instanceDelay * numInstances)
			++numInstances
		})
		this.setRequestOptions()
	}

	// Re-read the most recent worldstate dump and update all known records
	// If worldstate hasn't been read yet, update any old records when the next worldstate request occurs
	reload(): void {
		this.reloading = true
		this.setRequestOptions()
		this.db.setupTables(() => {
			if (this.ws) {
				log.info('Reloading %s worldstate', this.platform)
				this.readWorldstate()
			}
		})
	}

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

	// Return requested content from this instance
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
		const ret: {[key: string]: any} = {}
		ret.time = this.now
		for (const type of types) {
			// Timestamped database content
			const table = this.db.getTable(type)
			if (!table) {
				log.debug('"%s" is not a valid worldstate category', type)
			}
			else if (table.isReady()) {
				ret[type] = {
					time: table.getLastUpdate(),
					data: table.getAll()
				}
				log.debug('Sending %s', type)
			}
			else {
				ret[type] = ''
				log.debug('Database %s/%s is not ready', this.platform, type)
			}
		}
		return JSON.stringify(ret)
	}

	// Milliseconds until next worldstate request
	getNextUpdate(): number {
		return this.nextUpdate - Date.now()
	}

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

	private retryRequestWorldstate(code?: number, message?: string): void {
		if (code) {
			message = `${code}: ${message}`
		}
		log.error('%s worldstate request failed (%s)', this.platform, message)
		this.scheduleWorldstateRequest(this.retryTimeout)
		this.retryTimeout = Math.min(this.retryTimeout * 2, config.maxRetryTimeout)
	}

	// Read worldstate dump and schedule next request
	// Start the parsing process if the dump passes validity tests
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

	// Parse the worldstate dump using a chain of Promises to minimize blocking
	private readWorldstate(): void {
		promisify.queue(
			this,
			this.readNews,
			this.readAlerts,
			this.readGoals,
			this.readSorties,
			this.readVoidFissures,
			this.readSyndicateMissions,
			this.readInvasions,
			this.readUpgrades,
			this.readFactionProjects,
			this.readAcolytes,
			this.readVoidTraders,
			this.readDailyDeals,
			this.flushDb
		).catch(err => { log.error('Error reading worldstate: %s', err.message) })
		.then(() => { this.reloading = false })
	}

	// News field is called Events.
	// Events and tactical alerts are found in the Goals section
	private readNews(): void {
		const table = this.db.getTable('news') as WfDbTable<WfNews>
		if (!table || !this.ws.Events) {
			return
		}
		log.notice('Reading %s news', this.platform)
		let articles = this.ws.Events
		if (!articles[0]) {
			articles = []
		}
		const oldIds = table.getIdMap()
		for (const article of articles) {
			const id = h.getId(article),
				start = h.getDate(article.Date)
			if (!table.get(id) || this.reloading) {
				let text: string = ''
				for (const message of article.Messages) {
					if (message.LanguageCode == 'en') {
						text = message.Message
						break
					}
				}
				if (!text) {
					continue
				}
				const dbArticle: WfNews = {
						id: id,
						start: start,
						text: text,
						link: article.Prop,
					}
				if (article.EventStartDate) {
					dbArticle.eventStart = h.getDate(article.EventStartDate)
				}
				if (article.EventEndDate) {
					dbArticle.eventEnd = h.getDate(article.EventEndDate)
				}
				if (article.EventLiveUrl) {
					dbArticle.eventUrl = article.EventLiveUrl
				}
				table.add(id, dbArticle, true)
				log.debug('Found news article %s for %s', id, this.platform)
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			table.moveTmp(id)
		}
	}

	private readAlerts(): void {
		const table = this.db.getTable('alerts') as WfDbTable<WfAlert>
		if (!table || !this.ws.Alerts) {
			return
		}
		log.notice('Reading %s alerts', this.platform)
		let alerts = this.ws.Alerts
		if (!alerts[0]) {
			alerts = []
		}
		const oldIds = table.getIdMap()
		for (const alert of alerts) {
			const id = h.getId(alert)
			if (!id) {
				continue
			}
			const end = h.getDate(alert.Expiry)
			if (end >= this.now && (!table.get(id) || this.reloading)) {
				const mi = alert.MissionInfo,
					levelId = mi.levelOverride,
					rewards = items.getRewards(mi.missionReward),
					dbAlert: WfAlert = {
						id: id,
						start: h.getDate(alert.Activation),
						end: end,
						location: h.getLocation(mi.location),
						missionType: h.getMissionType(mi.missionType),
						faction: h.getFaction(mi.faction),
						minLevel: Number(mi.minEnemyLevel),
						maxLevel: Number(mi.maxEnemyLevel)
					}
				if (rewards) {
					dbAlert.rewards = rewards
				}
				table.add(id, dbAlert, true)
				log.debug('Found alert %s for %s', id, this.platform)
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			table.moveTmp(id)
		}
	}

	// The goals category is a "misc bin". Determine type and hand off to relevant function
	private readGoals(): void {
		if (!this.ws.Goals) {
			return
		}
		log.notice('Reading %s goals', this.platform)
		let goals = this.ws.Goals
		if (!goals[0]) {
			goals = []
		}
		const events = [],
			fomorians = []
		for (const goal of goals) {
			if (goal.Fomorian) {
				fomorians.push(goal)
			}
			else if (goal.Tag == 'GhoulEmergence') {
				// This is handled by readSyndicateMissions
			}
			else {
				events.push(goal)
			}
		}
		this.readEvents(events)
		this.readFomorians(fomorians)
	}

	private readEvents(events: any[]): void {
		const table = this.db.getTable('events') as WfDbTable<WfEvent>
		if (!table) {
			return
		}
		const oldIds = table.getIdMap()
		for (const event of events) {
			const id = h.getId(event),
				end = h.getDate(event.Expiry)
			if (!id) {
				continue
			}
			if (end >= this.now && (!table.get(id) || this.reloading)) {
				const dbEvent: WfEvent = {
						id: id,
						start: h.getDate(event.Activation),
						end: end,
						tag: event.Tag
					}
				if (event.Goal) {
					// Personal goal
					dbEvent.endGoal = event.Goal
				}
				if (event.Node) {
					dbEvent.location = h.getLocation(event.Node)
				}
				if (event.Faction) {
					dbEvent.faction = h.getFaction(event.Faction)
				}
				if (event.PrereqGoalTags) {
					// For multi-stage events with sub goals
					dbEvent.prereqTags = []
					const prereqTags = dbEvent.prereqTags
					for (const tag of event.PrereqGoalTags) {
						prereqTags.push(tag)
					}
				}
				if (event.Reward) {
					// Reward for meeting the event goals
					const rewards = items.getRewards(event.Reward)
					if (rewards) {
						dbEvent.rewards = rewards
					}
				}
				if (event.RewardNode) {
					// Node that unlocks after meeting the event goals
					dbEvent.rewardNode = h.getLocation(event.RewardNode)
				}
				if (event.ConcurrentNodes) {
					// All locations involved in the event and its sub goals
					dbEvent.subGoals = []
					const subGoals = dbEvent.subGoals
					for (const idx in event.ConcurrentNodes || []) {
						const subGoal: WfEventInterim = {
								location: h.getLocation(event.ConcurrentNode)
							},
							suffix = idx ? idx.toString() : '',
							rewardProperty = 'RewardsInterim' + suffix,
							requirementProperty = 'ConcurrentNodeReqs' + suffix
						if (event[rewardProperty]) {
							const rewards = items.getRewards(event[rewardProperty])
							if (rewards) {
								subGoal.rewards = rewards
							}
						}
						if (event[requirementProperty]) {
							subGoal.requirements = event[requirementProperty]
						}
						subGoals.push(subGoal)
					}
				}
				if (event.ClanGoal) {
					// Clan goal
					dbEvent.clanGoals = []
					for (const clanGoal of event.ClanGoal) {
						dbEvent.clanGoals.push(clanGoal)
					}
				}
				log.debug('Found event %s for %s', id, this.platform)
				table.add(id, dbEvent, true)
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			table.moveTmp(id)
		}
	}

	// Both the Razorback and Balor Fomorian are found in this section
	private readFomorians(fomorians: any[]): void {
		const table = this.db.getTable('fomorians') as WfDbTable<WfFomorian>
		if (!table) {
			return
		}
		const oldIds = table.getIdMap()
		for (const fomorian of fomorians) {
			const id = h.getId(fomorian),
				end = h.getDate(fomorian.Expiry),
				health = Number(fomorian.HealthPct)
			if (!id) {
				continue
			}
			if (end >= this.now) {
				let dbFomorian = table.get(id)
				if (!dbFomorian || this.reloading) {
					const start = h.getDate(fomorian.Activation),
						mi = fomorian.MissionInfo,
						fomorianType = h.getFomorianType(fomorian.Faction),
						missionType = h.getMissionType(mi.missionType),
						victimLocation = h.getLocation(fomorian.VictimNode),
						missionLocation = h.getLocation(mi.location),
						requiredItems = items.getItems(mi.requiredItems)
					if (dbFomorian) {
						// Reloading flag was set
						dbFomorian.start = start
						dbFomorian.end = end
						dbFomorian.type = fomorianType
						dbFomorian.endGoal = fomorian.Goal
						dbFomorian.missionType = missionType
						dbFomorian.victimLocation = victimLocation
						dbFomorian.missionLocation = missionLocation
						dbFomorian.requiredItems = requiredItems
					}
					else {
						// New entry
						dbFomorian = {
							id: id,
							start: start,
							end: end,
							type: fomorianType,
							health: 1,
							healthHistory: [[start, 1]],
							endGoal: fomorian.Goal,
							missionType: missionType,
							victimLocation: victimLocation,
							missionLocation: missionLocation,
							requiredItems: requiredItems
						}
					}
					if (fomorian.Reward) {
						const rewards = items.getRewards(fomorian.Reward)
						if (rewards) {
							dbFomorian.goalRewards = rewards
						}
					}
					if (mi.missionReward) {
						if (mi.missionReward.randomizedItems) {
							const rewards = items.getRandomRewards(mi.missionReward.randomizedItems)
							if (rewards) {
								dbFomorian.randomRewards = rewards
							}
						}
						else {
							const rewards = items.getRewards(mi.missionReward)
							if (rewards) {
								dbFomorian.missionRewards = rewards
							}
						}
					}
					table.add(id, dbFomorian, true)
					log.debug('Found fomorian %s for %s', id, this.platform)
				}
				if (dbFomorian.health != health) {
					log.debug('Updating fomorian %s for %s (%f -> %f)', id, this.platform, dbFomorian.health, health)
					const healthHistory = dbFomorian.healthHistory
					this.updateProgress(health, healthHistory)
					const healthDiff = healthHistory[healthHistory.length - 2][1] - health
					if (healthDiff >= 0.01 || health <= 0) {
						// On >=1% changes, make last history entry permanent and update database
						healthHistory[healthHistory.length - 1][0] = this.now
						table.updateTmp(id, {
							health: health,
							healthHistory: healthHistory
						})
					}
					dbFomorian.health = health
				}
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			const dbFomorian = table.get(id)
			if (dbFomorian) {
				this.endProgress(dbFomorian.healthHistory)
				dbFomorian.health = 0
				table.moveTmp(id)
			}
		}
	}

	private readSorties(): void {
		const table = this.db.getTable('sorties') as WfDbTable<WfSortie>
		if (!table || !this.ws.Sorties) {
			return
		}
		log.notice('Reading %s sorties', this.platform)
		let sorties = this.ws.Sorties
		if (!sorties[0]) {
			sorties = []
		}
		const oldIds = table.getIdMap()
		for (const sortie of sorties) {
			const id = h.getId(sortie)
			if (!id) {
				continue
			}
			const start = h.getDate(sortie.Activation),
				end = h.getDate(sortie.Expiry)
			if (end >= this.now && (!table.get(id) || this.reloading)) {
				const { faction, name: boss } = tags.sortieBosses[sortie.Boss] || { faction: 'Unknown', name: sortie.Boss },
					missions: WfSortieMission[] = [],
					dbSortie: WfSortie = {
						id: id,
						start: start,
						end: end,
						faction: h.getFaction(faction),
						bossName: boss,
						rewards: items.getRandomRewards(sortie.Reward),
						missions: missions
					}
				for (const mission of sortie.Variants) {
					missions.push({
						missionType: h.getMissionType(mission.missionType),
						modifier: tags.sortieModifiers[mission.modifierType] || mission.modifierType,
						location: h.getLocation(mission.node)
					})
				}
				table.add(id, dbSortie, true)
				log.debug('Found sortie %s for %s', id, this.platform)
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			table.moveTmp(id)
		}
	}

	private readVoidFissures(): void {
		const table = this.db.getTable('fissures') as WfDbTable<WfVoidFissure>
		if (!table || !this.ws.ActiveMissions) {
			return
		}
		log.notice('Reading %s void fissures', this.platform)
		let fissures = this.ws.ActiveMissions
		if (!fissures[0]) {
			fissures = []
		}
		const oldIds = table.getIdMap()
		for (const fissure of fissures) {
			const id = h.getId(fissure)
			if (!id) {
				continue
			}
			const end = h.getDate(fissure.Expiry)
			if (end >= this.now && (!table.get(id) || this.reloading)) {
				const dbFissure: WfVoidFissure = {
					id: id,
					start: h.getDate(fissure.Activation),
					end: end,
					location: h.getLocation(fissure.Node),
					faction: h.getNodeFaction(fissure.Node),
					missionType: h.getNodeMissionType(fissure.Node),
					tier: h.getVoidTier(fissure.Modifier)
				}
				table.add(id, dbFissure, true)
				log.debug('Found void fissure %s for %s', id, this.platform)
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			table.moveTmp(id)
		}
	}

	private readInvasions(): void {
		const table = this.db.getTable('invasions') as WfDbTable<WfInvasion>
		if (!table || !this.ws.Invasions) {
			return
		}
		log.notice('Reading %s invasions', this.platform)
		let invasions = this.ws.Invasions
		if (!invasions[0]) {
			invasions = []
		}
		const oldIds = table.getIdMap()
		for (const invasion of invasions) {
			const id = h.getId(invasion)
			if (!id) {
				continue
			}
			const start = h.getDate(invasion.Activation),
				score = Number(invasion.Count)
			if (!start) {
				continue
			}
			let dbInvasion = table.get(id)
			if (!dbInvasion || this.reloading) {
				const location = h.getLocation(invasion.Node),
					endScore = Number(invasion.Goal),
					// Reversed because xMissionInfo.faction is the mission's opposing faction
					factionAttacker = h.getFaction(invasion.DefenderMissionInfo.faction),
					factionDefender = h.getFaction(invasion.AttackerMissionInfo.faction)
				if (dbInvasion) {
					// Reloading flag set
					dbInvasion.start = start
					dbInvasion.endScore = endScore
					dbInvasion.location = location
					dbInvasion.factionAttacker = factionAttacker
					dbInvasion.factionDefender = factionDefender
				}
				else {
					dbInvasion = {
						id: id,
						start: start,
						endScore: endScore,
						location: h.getLocation(invasion.Node),
						score: 0,
						scoreHistory: [[start, 0]],
						factionAttacker: factionAttacker,
						factionDefender: factionDefender
					}
				}
				if (invasion.AttackerReward) {
					const rewards = items.getRewards(invasion.AttackerReward)
					if (rewards) {
						dbInvasion.rewardsAttacker = rewards
					}
				}
				if (invasion.DefenderReward) {
					const rewards = items.getRewards(invasion.DefenderReward)
					if (rewards) {
						dbInvasion.rewardsDefender = rewards
					}
				}
				table.add(id, dbInvasion, true)
				log.debug('Found invasion %s for %s', id, this.platform)
			}
			if (dbInvasion.score != score) {
				log.debug('Updating invasion %s for %s (%f -> %f)', id, this.platform, dbInvasion.score, score)
				const scoreHistory = dbInvasion.scoreHistory
				let lastHist = scoreHistory[scoreHistory.length - 1]
				const prevScore = lastHist[1],
					scoreDiff = score - prevScore,
					prevScoreDiff = scoreHistory.length > 1 ? prevScore - scoreHistory[scoreHistory.length - 2][1] : 0,
					isDirectionChange = (scoreDiff < 0 && prevScoreDiff > 0) || (scoreDiff > 0 && prevScoreDiff < 0),
					isLeaderChange = (score <= 0 && prevScore > 0) || (score >= 0 && prevScore < 0)
				let updateDb = false
				if (isLeaderChange || (isDirectionChange && Math.abs(scoreDiff) / dbInvasion.endScore >= 0.001)) {
					// Update <scoreHistory> if leading faction changes or we reach a local maximum on the history plot
					const prevTime = Math.abs(lastHist[0])
					if (isDirectionChange) {
						// Record the point of the local maximum
						lastHist[0] = prevTime
						lastHist = [-this.now, score]
						scoreHistory.push(lastHist)
						updateDb = true
					}
					if (isLeaderChange) {
						// Interpolate to find point where faction advantage changes
						// ylerp = xlerp*dy/dx + y0, ylerp = 0 => xlerp = -dx*y0/dy
						lastHist[0] = Math.round(prevTime - (this.now - prevTime) * prevScore / scoreDiff)
						lastHist[1] = 0
						lastHist = [-this.now, score]
						scoreHistory.push(lastHist)
						updateDb = true
					}
				}
				else if (lastHist[0] < 0) {
					lastHist[0] = -this.now
					lastHist[1] = score
				}
				else {
					lastHist = [-this.now, score]
					scoreHistory.push(lastHist)
				}
				const isLargeDiff = Math.abs(score - scoreHistory[scoreHistory.length - 2][1]) / dbInvasion.endScore >= 0.01
				if (isLargeDiff || Math.abs(score) >= dbInvasion.endScore) {
					lastHist[0] = this.now
					updateDb = true
				}
				if (updateDb) {
					table.updateTmp(id, {
						score: score,
						scoreHistory: scoreHistory
					})
				}
				dbInvasion.score = score
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			const dbInvasion = table.get(id)
			if (dbInvasion) {
				const scoreHistory = dbInvasion.scoreHistory
				if (scoreHistory[scoreHistory.length - 1][0] < 0) {
					// Remove last history entry if it's temporary
					scoreHistory.pop()
				}
				const prevScore = scoreHistory[scoreHistory.length - 1][1],
					score = prevScore > 0 ? dbInvasion.endScore : -dbInvasion.endScore
				if (score != prevScore) {
					// Add final entry if necessary
					scoreHistory.push([this.now, score])
					dbInvasion.score = score
				}
				table.moveTmp(id)
			}
		}
	}

	// Syndicate missions and Bounties are found under the same key
	private readSyndicateMissions(): void {
		log.notice('Reading %s syndicate missions', this.platform)
		const bounties = []
		if (this.ws.SyndicateMissions && this.ws.SyndicateMissions[0]) {
			for (const missions of this.ws.SyndicateMissions) {
				if (missions.Jobs) {
					bounties.push(missions)
				}
			}
		}
		if (this.ws.Goals && this.ws.Goals[0]) {
			for (const goal of this.ws.Goals) {
				if (goal.Tag == 'GhoulEmergence' && goal.Jobs) {
					bounties.push(goal)
				}
			}
		}
		this.readBounties(bounties)
	}

	private readBounties(bounties: any[]): void {
		const table = this.db.getTable('bounties') as WfDbTable<WfBounty>
		if (!table) {
			return
		}
		log.notice('Reading %s bounties', this.platform)
		const oldIds = table.getIdMap()
		for (const bounty of bounties) {
			const id = h.getId(bounty)
			if (!id) {
				continue
			}
			const start = h.getDate(bounty.Activation),
				end = h.getDate(bounty.Expiry),
				health = Number(bounty.HealthPct || 0)
			if (end >= this.now) {
				let dbBounty = table.get(id)
				if (!dbBounty || this.reloading) {
					const syndicate = h.getSyndicateName(bounty.Tag),
						dbJobs: WfBountyJob[] = []
					if (dbBounty) {
						dbBounty.start = start
						dbBounty.end = end
						dbBounty.syndicate = syndicate
						dbBounty.jobs = dbJobs
					}
					else {
						dbBounty = {
							id: id,
							start: start,
							end: end,
							syndicate: syndicate,
							jobs: dbJobs
						}
						if ('HealthPct' in bounty) {
							dbBounty.health = health
							dbBounty.healthHistory = [[this.now, health]]
						}
					}
					if ('VictimNode' in bounty) {
						dbBounty.location = h.getLocation(bounty.VictimNode)
					}
					for (const job of bounty.Jobs) {
						dbJobs.push({
							rewards: items.getBountyRewards(bounty.Tag, job.rewards),
							minLevel: job.minEnemyLevel,
							maxLevel: job.maxEnemyLevel,
							xpAmounts: job.xpAmounts
						})
					}
					table.add(id, dbBounty, true)
				}
				if (dbBounty.healthHistory && dbBounty.health != health) {
					const healthHistory = dbBounty.healthHistory
					this.updateProgress(health, healthHistory)
					const healthDiff = healthHistory[healthHistory.length - 2][1] - health
					if (healthDiff >= 0.01 || health <= 0) {
						healthHistory[healthHistory.length - 1][0] = this.now
						table.updateTmp(id, {
							health: health,
							healthHistory: healthHistory
						})
						log.debug('Updating bounty %s for %s (%f -> %f)', id, this.platform, dbBounty.health, health)
					}
					dbBounty.health = health
				}
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			const dbBounty = table.get(id)
			if (dbBounty) {
				if (dbBounty.healthHistory) {
					this.endProgress(dbBounty.healthHistory)
					dbBounty.health = 0
				}
				table.moveTmp(id)
			}
		}
	}

	private readUpgrades(): void {
		const table = this.db.getTable('upgrades') as WfDbTable<WfUpgrade>
		if (!table || !this.ws.GlobalUpgrades) {
			return
		}
		log.notice('Reading %s global upgrades', this.platform)
		let upgrades = this.ws.GlobalUpgrades
		if (!upgrades[0]) {
			upgrades = []
		}
		const oldIds = table.getIdMap()
		for (const upgrade of upgrades) {
			const id = h.getId(upgrade)
			if (!id) {
				continue
			}
			const end = h.getDate(upgrade.ExpiryDate)
			if (end >= this.now && (!table.get(id) || this.reloading)) {
				const upgradeType = tags.upgradeTypes[upgrade.UpgradeType] || upgrade.UpgradeType
				table.add(id, {
					id: id,
					start: h.getDate(upgrade.Activation),
					end: end,
					type: upgradeType,
					opType: upgrade.OperationType,
					value: Number(upgrade.Value)
				}, true)
				log.debug('Found global upgrade %s for %s (%s)', id, this.platform, upgradeType)
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			table.moveTmp(id)
		}
	}

	private readVoidTraders(): void {
		const table = this.db.getTable('voidtraders') as WfDbTable<WfVoidTrader>
		if (!table || !this.ws.VoidTraders) {
			return
		}
		log.notice('Reading %s void traders', this.platform)
		let voidTraders = this.ws.VoidTraders
		if (!voidTraders[0]) {
			voidTraders = []
		}
		const oldIds = table.getIdMap()
		for (const voidTrader of voidTraders) {
			let id = h.getId(voidTrader)
			if (!id) {
				continue
			}
			const start = h.getDate(voidTrader.Activation),
				end = h.getDate(voidTrader.Expiry)
			id += start.toString()
			if (end >= this.now) {
				let dbVoidTrader = table.get(id),
					isKnown = dbVoidTrader != null
				if (!dbVoidTrader || this.reloading) {
					dbVoidTrader = {
						id: id,
						start: start,
						end: end,
						name: h.getVoidTraderName(voidTrader.Character),
						location: h.getLocation(voidTrader.Node),
						active: false
					}
					isKnown = false
				}
				if (!dbVoidTrader.active && start <= this.now) {
					const vtItems: WfVoidTraderItem[] = [],
						manifest = voidTrader.Manifest || []
					dbVoidTrader.active = true
					dbVoidTrader.items = vtItems
					for (const wsItem of manifest) {
						const item = items.getItem(wsItem.ItemType)
						vtItems.push({
							name: item.name,
							type: item.type,
							ducats: Number(wsItem.PrimePrice),
							credits: Number(wsItem.RegularPrice)
						})
					}
					if (isKnown) {
						log.debug('Updating void trader %s for %s', id, this.platform)
						table.updateTmp(id, {
							active: true,
							items: vtItems
						})
					}
				}
				if (!isKnown || this.reloading) {
					log.debug('Found void trader %s for %s', id, this.platform)
					table.add(id, dbVoidTrader, true)
				}
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			table.moveTmp(id)
		}
	}

	private readFactionProjects(): void {
		const table = this.db.getTable('factionprojects') as WfDbTable<WfFomorianProgress>
		if (!table || !this.ws.ProjectPct) {
			return
		}
		log.notice('Reading %s faction projects', this.platform)
		let factionProjects = this.ws.ProjectPct
		if (!factionProjects[0]) {
			return
		}
		for (const projectIdx in factionProjects) {
			const progress = Number(factionProjects[projectIdx]),
				id = projectIdx.toString(),
				faction = h.getFomorianFaction(id)
			if (!faction) {
				continue
			}
			const fomorianType = h.getFomorianType(faction)
			let dbProject = table.get(id)
			if (!dbProject || this.reloading) {
				log.debug('Found faction project %s for %s', id, this.platform)
				if (dbProject) {
					dbProject.type = fomorianType
				}
				else {
					dbProject = {
						id: id,
						type: fomorianType,
						progress: progress,
						progressHistory: [[this.now, progress]]
					}
				}
				table.add(id, dbProject, true)
			}
			if (progress > dbProject.progress) {
				const progressHistory = dbProject.progressHistory
				this.updateProgress(progress, progressHistory)
				const progressDiff = progress - progressHistory[progressHistory.length - 2][1]
				if (progressDiff > 0) {
					log.debug('Updating faction project %s for %s (%f -> %f)', id, this.platform, dbProject.progress, progress)
					dbProject.progress = progress
					if (progressDiff >= 1) {
						progressHistory[progressHistory.length - 1][0] = this.now
						table.updateTmp(id, {
							progress: progress,
							progressHistory: progressHistory
						})
					}
				}
			}
			else if (progress < dbProject.progress) {
				// Faction project was probably reset
				log.debug('Resetting faction project %s for %s (%f -> %f)', id, this.platform, dbProject.progress, progress)
				const prevProgress = dbProject.progressHistory[dbProject.progressHistory.length - 1]
				if (prevProgress[0] < 0) {
					prevProgress[0] = -prevProgress[0]
				}
				table.moveTmp(id)
				table.add(id, {
					id: id,
					type: fomorianType,
					progress: progress,
					progressHistory: [[this.now, progress]]
				}, true)
			}
		}
	}

	private readAcolytes(): void {
		const table = this.db.getTable('acolytes') as WfDbTable<WfAcolyte>
		if (!table || !this.ws.PersistentEnemies) {
			return
		}
		log.notice('Reading %s acolytes', this.platform)
		let acolytes = this.ws.PersistentEnemies
		if (!acolytes[0]) {
			acolytes = []
		}
		const oldIds = table.getIdMap()
		for (const acolyte of acolytes) {
			const id = h.getId(acolyte)
			if (!id) {
				continue
			}
			const health = Number(acolyte.HealthPercent),
				discovered = acolyte.Discovered == true,
				location = h.getLocation(acolyte.LastDiscoveredLocation)
			let dbAcolyte = table.get(id)
			if (!dbAcolyte || this.reloading) {
				const acolyteName = h.getAcolyteName(acolyte.LocTag)
				if (dbAcolyte) {
					dbAcolyte.name = acolyteName
					dbAcolyte.discovered = discovered
					dbAcolyte.location = location
				}
				else {
					dbAcolyte = {
						id: id,
						name: acolyteName,
						health: health,
						healthHistory: [[this.now, health]],
						discovered: discovered,
						location: location,
					}
				}
				table.add(id, dbAcolyte, true)
				log.debug('Found acolyte %s for %s', id, this.platform)
			}
			if (dbAcolyte.discovered != discovered) {
				dbAcolyte.discovered = discovered
				dbAcolyte.location = location
				table.updateTmp(id, {
					discovered: discovered,
					location: location
				})
				log.debug('Updating acolyte %s for %s (discovered -> s)', id, this.platform, discovered ? 'true' : 'false')
			}
			if (dbAcolyte.health != health) {
				const healthHistory = dbAcolyte.healthHistory,
					prevHealth = healthHistory[healthHistory.length - 1]
				if (prevHealth[0] < 0) {
					// The continuously updated entry in <healthHistory> has a negative timestamp
					prevHealth[0] = -this.now
					prevHealth[1] = health
				}
				else {
					// Last entry was made permanent. Push new continuously updated one
					healthHistory.push([-this.now, health])
				}
				const healthDiff = healthHistory[healthHistory.length - 2][1] - health
				if (healthDiff >= 0.01) {
					healthHistory[healthHistory.length - 1][0] = this.now
					table.updateTmp(id, {
						health: health,
						healthHistory: healthHistory
					})
					log.debug('Updating acolyte %s for %s (%f -> %f)', id, this.platform, dbAcolyte.health, health)
				}
				dbAcolyte.health = health
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			const dbAcolyte = table.get(id)
			if (dbAcolyte) {
				this.endProgress(dbAcolyte.healthHistory)
				dbAcolyte.health = 0
				table.moveTmp(id)
			}
		}
	}

	private readDailyDeals(): void {
		const table = this.db.getTable('dailydeals') as WfDbTable<WfDailyDeal>
		if (!table || !this.ws.DailyDeals) {
			return
		}
		log.notice('Reading %s daily deals', this.platform)
		let deals = this.ws.DailyDeals
		if (!deals[0]) {
			deals = []
		}
		const oldIds = table.getIdMap()
		for (const deal of deals) {
			const start = h.getDate(deal.Activation),
				end = h.getDate(deal.Expiry),
				id = start.toString()
			if (end >= this.now) {
				let dbDeal = table.get(id)
				if (!dbDeal || this.reloading) {
					const item = items.getItem(deal.StoreItem)
					if (dbDeal) {
						dbDeal.start = start
						dbDeal.end = end
						dbDeal.item = item
						dbDeal.price = deal.SalePrice
						dbDeal.originalPrice = deal.OriginalPrice
						dbDeal.stock = deal.AmountTotal
					}
					else {
						dbDeal = {
							id: id,
							start: start,
							end: end,
							item: item,
							price: deal.SalePrice,
							originalPrice: deal.OriginalPrice,
							stock: deal.AmountTotal,
							sold: deal.AmountSold
						}
					}
					table.add(id, dbDeal, true)
					log.debug('Found daily deal %s for %s (%s)', id, this.platform, item.name)
				}
				if (deal.AmountSold != dbDeal.sold) {
					dbDeal.sold = deal.AmountSold
					table.updateTmp(id, {
						sold: deal.AmountSold
					})
				}
			}
			delete oldIds[id]
		}
		for (const id in oldIds) {
			table.moveTmp(id)
		}
	}

	private flushDb(): void {
		this.db.flush()
	}

	private updateProgress(progress: number, progressHistory: WfProgressHistory): void {
		const prev = progressHistory[progressHistory.length - 1]
		if (prev[0] < 0) {
			// The continuously updated entry in <progressHistory> has a negative timestamp
			prev[0] = -this.now
			prev[1] = progress
		}
		else {
			// Last entry is a permanent record. Push new continuously updated one
			progressHistory.push([-this.now, progress])
		}
	}

	private endProgress(progressHistory: WfProgressHistory): void {
		if (progressHistory[progressHistory.length - 1][0] < 0) {
			// Remove last history entry if it's temporary
			progressHistory.pop()
		}
		if (progressHistory[progressHistory.length - 1][1] > 0) {
			// Add final entry if necessary
			progressHistory.push([this.now, 0])
		}
	}
}
