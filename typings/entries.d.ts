interface BaseEntry {
	_id: { $oid: string }
}

interface TimestampLong {
	$date: { $numberLong: number }
}

interface DateStartEntry {
	Activation: TimestampLong
}

interface DateEndEntry {
	Expiry: TimestampLong
}

interface AcolyteEntry extends BaseEntry {
	LocTag: string
	HealthPercent: number
	Discovered: boolean
	LastDiscoveredLocation: string
}

interface AlertEntry extends BaseEntry, DateStartEntry, DateEndEntry {
	MissionInfo: AlertMissionEntry
}

interface AlertMissionEntry {
	location: string
	missionType: string
	faction: string
	minEnemyLevel: string
	maxEnemyLevel: string
	maxWaveNum?: number
	missionReward: {
		credits: number
		items: string[]
	}
}

interface BountyEntry extends BaseEntry, DateStartEntry, DateEndEntry {
	HealthPct: number
	Tag: string
	VictimNode: string
	Jobs: BountyJobEntry[]
}

interface BountyJobEntry {
	minEnemyLevel: number
	maxEnemyLevel: number
	xpAmounts: number[]
	rewards: string
	isVault?: boolean
}

interface ChallengeSeasonEntry extends DateStartEntry, DateEndEntry {
	AffiliationTag: string
	ActiveChallenges: ChallengeEntry[]
	Season: number
	Phase: number
}

interface ChallengeEntry extends BaseEntry, DateStartEntry, DateEndEntry {
	Challenge: string
	Daily: boolean
}

interface DailyDealEntry extends BaseEntry, DateStartEntry, DateEndEntry {
	StoreItem: string
	AmountSold: number
	SalePrice: number
	OriginalPrice: number
	AmountTotal: number
}

type FactionProjectEntry = number[]

interface GoalEntry extends BaseEntry, DateStartEntry, DateEndEntry, BountyEntry {
	Faction: string
	Fomorian: boolean
	Goal: number
	MissionInfo: GoalMissionEntry
	Reward: GoalMissionRewardEntry
}

interface GoalMissionEntry {
	requiredItems: string[]
	missionType: string
	location: string
	missionReward: GoalMissionRewardEntry & GoalMissionRandomRewardEntry
	randomizedItems: string
}

interface GoalMissionRewardEntry {
	credits?: number
	items: string[]
}

interface GoalMissionRandomRewardEntry {
	randomizedItems: string
}

interface InvasionEntry extends BaseEntry, DateStartEntry {
	Count: number
	Goal: number
	Node: string
	AttackerMissionInfo: InvasionMissionEntry
	AttackerReward: InvasionReward
	DefenderMissionInfo: InvasionMissionEntry
	DefenderReward: InvasionReward
}

interface InvasionMissionEntry {
	faction: string
}

interface InvasionReward {
	countedItems: Array<{
		ItemType: string
		ItemCount: string
	}>
}

interface KuvalogEntry {
	missiontype: string
	start: string
	end: string
	solnode: string
}

interface NewsEntry extends BaseEntry {
	Date: TimestampLong
	Messages: Array<{
		LanguageCode: string
		Message: string
	}>
	EventStartDate?: TimestampLong
	EventEndDate?: TimestampLong
	EventLiveUrl?: string
	Prop: string
	Links?: Array<{
		LanguageCode: string
		Link: string
	}>
}

interface SortieEntry extends BaseEntry, DateStartEntry, DateEndEntry {
	Boss: string
	Reward: string
	Variants: SortieVariantEntry[]
}

interface SortieVariantEntry {
	missionType: string
	modifierType: string
	node: string
}

interface UpgradeEntry extends BaseEntry {
	Activation: { sec: string }
	ExpiryDate: { sec: string }
	UpgradeType: string
	OperationType: string
	Value: string
}

interface VoidFissureEntry extends BaseEntry, DateStartEntry, DateEndEntry {
	Node: string
	Modifier: string
}

interface VoidStormEntry extends BaseEntry, DateStartEntry, DateEndEntry {
	ActiveMissionTier: string
	Node: string
}

interface VoidTraderEntry extends BaseEntry, DateStartEntry, DateEndEntry {
	Character: string
	Node: string
	Manifest: VoidTraderItemEntry[]
}

interface VoidTraderItemEntry {
	ItemType: string
	PrimePrice: number
	RegularPrice: number
}
