interface WfAcolyte {
	id: string
	name: string
	health: number
	healthHistory: WfProgressHistory
	discovered: boolean
	location: string
	rewards?: WfRandomRewardTable
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

interface WfArbitration {
	id: string
	start: number
	end: number
	location: string
	missionType: string
	faction: string
	rewards: WfRandomRewardTable
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

interface WfDayNight {
	id: string
	start: number
	length: number
	dayStart: number
	dayEnd: number
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

interface WfKuvaSiphon {
	id: string
	start: number
	end: number
	location: string
	missionType: string
	faction: string
	flood: boolean
	rewards: WfRandomRewardTable
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

interface WfNews {
	id: string
	start: number
	text: string
	link: string
	eventStart?: number
	eventEnd?: number
	eventUrl?: string
}

interface WfSortieMission {
	missionType: string
	modifier: string
	location: string
}

interface WfSentientAnomaly {
	id: string
	start: number
	end?: number
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

interface WfVoidFissure {
	id: string
	start: number
	end: number
	location: string
	faction: string
	missionType: string
	tier: string
	hard: boolean
}

type WfVoidStorm = Omit<WfVoidFissure, 'hard'>

interface WfUpgrade {
	id: string
	start: number
	end: number
	type: string
	opType: string
	value: number
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
