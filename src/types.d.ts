interface WfMap {
	[key: string]: string
}

interface WfSet {
	[key: string]: true
}

interface WfItem {
	name: string
	type: string
}

interface WfReward extends WfItem {
	count: number
}

interface WfRewards {
	credits?: number
	items?: WfReward[]
}

interface WfRandomReward extends WfItem {
	count: number
	chance: number
}

type WfRandomRewardTable = WfRandomReward[][]

type WfRewardTableMap = {
	[tableId: string]: WfRandomRewardTable
}

type WfProgressHistory = [number, number][]

interface WfChallengeInfo {
	description: string,
	xpAmount: number
}

interface WfAlert {
	id: string
	start: number
	end: number
	location: string
	missionType: string
	faction: string
	minLevel: number
	maxLevel: number
	missionLength?: number
	rewards?: WfRewards
}

interface WfInvasion {
	id: string
	start: number
	endScore: number
	score: number
	scoreHistory: WfProgressHistory
	location: string
	factionAttacker: string
	factionDefender: string
	rewardsAttacker?: WfRewards
	rewardsDefender?: WfRewards
}

interface WfSortieMission {
	missionType: string
	modifier: string
	location: string
}

interface WfSortie {
	id: string
	start: number
	end: number
	faction: string
	bossName: string
	rewards: WfRandomRewardTable
	missions: WfSortieMission[]
}

interface WfBountyJob {
	minLevel: number
	maxLevel: number
	xpAmounts: number[]
	rewards: WfRandomRewardTable
	rotation?: string
	title?: string
}

interface WfBounty {
	id: string
	start: number
	end: number
	syndicate: string
	jobs: WfBountyJob[]
	location?: string
	health?: number
	healthHistory?: WfProgressHistory
}

interface WfVoidFissure {
	id: string
	start: number
	end: number
	location: string
	faction: string
	missionType: string
	tier: string
}

interface WfEventInterim {
	location: string
	requirements?: number
	rewards?: WfRewards
}

interface WfEvent {
	id: string
	start: number
	end: number
	tag: string
	endGoal?: number
	location?: string
	faction?: string
	prereqTags?: string[]
	rewards?: WfRewards
	rewardNode?: string
	subGoals?: WfEventInterim[]
	clanGoals?: number[]
}

interface WfFomorian {
	id: string
	start: number
	end: number
	type: string
	health: number
	healthHistory: WfProgressHistory
	endGoal: number
	missionType: string
	victimLocation: string
	missionLocation: string
	requiredItems?: WfItem[]
	goalRewards?: WfRewards
	missionRewards?: WfRewards
	randomRewards?: WfRandomRewardTable
}

interface WfFomorianProgress {
	id: string
	type: string
	progress: number
	progressHistory: WfProgressHistory
}

interface WfVoidTraderItem extends WfItem {
	ducats: number
	credits: number
}

interface WfVoidTrader {
	id: string
	start: number
	end: number
	name: string
	location: string
	active: boolean
	items?: WfVoidTraderItem[]
}

interface WfNews {
	id: string
	start: number
	text: string
	link: string
	eventStart?: number
	eventEnd?: number
	eventUrl?: string
}

interface WfAcolyte {
	id: string
	name: string
	health: number
	healthHistory: WfProgressHistory
	discovered: boolean
	location: string
}

interface WfDailyDeal {
	id: string
	start: number
	end: number
	item: WfItem
	price: number
	originalPrice: number
	stock: number
	sold: number
}

interface WfUpgrade {
	id: string
	start: number
	end: number
	type: string
	opType: string
	value: number
}

interface WfDayNight {
	id: string
	start: number
	length: number
	dayStart: number
	dayEnd: number
}

interface WfChallenge {
	id: string
	start: number
	end: number
	daily: boolean
	description: string
	xpAmount: number
}

interface WfChallengeSeason {
	id: string
	start: number
	end: number
	syndicate: string
	season: number
	phase: number
	challenges: WfChallenge[]
}

interface WfReader {
	start(db: WfDb): void
	read(input: any[], timestamp: number): void
	readonly entityRewards: WfRewardTableMap
}

interface WfDb {
	setupTables(onLoad: () => void): void
	getTable<T extends keyof WfRecordTypes>(tblName: T): WfDbTable<WfRecordTypes[T]>
	getTable<T extends WfRecordType>(tblName: string): WfDbTable<T>
	flush(): void
	setPaths(): void
}

interface WfDbTableI<T extends WfRecordType> {
	setPath(): void
	isReady(): boolean
	get(id: string): T | null
	getAll(): T[]
	getIdMap(): WfSet
	getLastUpdate(): number
	add(id: string, data: T, write: boolean): void
	moveTmp(id: string): void
	remove(id: string): void
	updateTmp(id: string, data: any): void
	flush(): void
}

type WfDbTable<T extends WfRecordType> = WfDbTableI<T> | null

type WfRecordTypes = {
	news: WfNews
	alerts: WfAlert
	events: WfEvent
	fomorians: WfFomorian
	sorties: WfSortie
	invasions: WfInvasion
	fissures: WfVoidFissure
	bounties: WfBounty
	factionprojects: WfFomorianProgress
	voidtraders: WfVoidTrader
	acolytes: WfAcolyte
	dailydeals: WfDailyDeal
	upgrades: WfUpgrade
	daynight: WfDayNight
	challenges: WfChallengeSeason
}

type WfRecordType = WfRecordTypes[keyof WfRecordTypes]
