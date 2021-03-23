type WfMap<T extends string = string, U = string> = {
	[key in T]?: U
}

type WfSet<T extends string = string> = {
	[key in T]?: true
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

type WfPlatform = 'pc' | 'ps4' | 'xb1' | 'ns'

type WfProgressHistory = [number, number][]

interface WfChallengeInfo {
	description: string,
	xpAmount: number
}

type WfRecordTypes = {
	'acolytes': WfAcolyte
	'alerts': WfAlert
	'arbitrations': WfArbitration
	'bounties': WfBounty
	'challenges': WfChallengeSeason
	'dailydeals': WfDailyDeal
	'daynight': WfDayNight
	'factionprojects': WfFomorianProgress
	'fissures': WfVoidFissure
	'fomorians': WfFomorian
	'invasions': WfInvasion
	'kuvasiphons': WfKuvaSiphon
	'news': WfNews
	'sentient-anomalies': WfSentientAnomaly
	'sorties': WfSortie
	'upgrades': WfUpgrade
	'voidtraders': WfVoidTrader
}

type WfRecordKey = keyof WfRecordTypes

type WfRecordType = WfRecordTypes[WfRecordKey]
