import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')
import history = require('../history')

export default class FomorianReader implements WfReader {
	private dbTable!: WfDbTable<WfFomorian>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('fomorians')
	}

	read(fomoriansInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s fomorians', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const fomorianInput of fomoriansInput) {
			const id = h.getId(fomorianInput),
				end = h.getDate(fomorianInput.Expiry),
				health = Number(fomorianInput.HealthPct)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				let fomorianDb = this.dbTable.get(id)
				const start = h.getDate(fomorianInput.Activation),
					mi = fomorianInput.MissionInfo,
					requiredItems = items.getItems(mi.requiredItems),
					fomorianCurrent: WfFomorian = {
						id: id,
						start: start,
						end: end,
						type: h.getFomorianType(fomorianInput.Faction),
						health: 1,
						healthHistory: [[start, 1]],
						endGoal: fomorianInput.Goal,
						missionType: h.getMissionType(mi.missionType),
						victimLocation: h.getLocation(fomorianInput.VictimNode),
						missionLocation: h.getLocation(mi.location),
						requiredItems: requiredItems
					}
				if (fomorianInput.Reward) {
					const rewards = items.getRewards(fomorianInput.Reward)
					if (rewards) {
						fomorianCurrent.goalRewards = rewards
					}
				}
				if (mi.missionReward) {
					if (mi.missionReward.randomizedItems) {
						const rewards = items.getRandomRewards(mi.missionReward.randomizedItems)
						if (rewards) {
							fomorianCurrent.randomRewards = rewards
						}
					}
					else {
						const rewards = items.getRewards(mi.missionReward)
						if (rewards) {
							fomorianCurrent.missionRewards = rewards
						}
					}
				}

				if (fomorianDb) {
					const diff = this.getDifference(fomorianDb, fomorianCurrent)
					if (Object.keys(diff).length) {
						compare.patch(fomorianDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating fomorian %s for %s', id, this.platform)
					}
				}
				else {
					fomorianDb = fomorianCurrent
					this.dbTable.add(id, fomorianDb, true)
					log.debug('Found fomorian %s for %s', id, this.platform)
				}

				if (fomorianDb.health != health) {
					const healthHistory = fomorianDb.healthHistory
					history.update(health, healthHistory, timestamp)
					if (history.checkpoint(health, healthHistory, timestamp, 0.01)) {
						this.dbTable.updateTmp(id, {
							health: health,
							healthHistory: healthHistory
						})
					}
					log.debug('Updating fomorian %s for %s (%f -> %f)', id, this.platform, fomorianDb.health, health)
					fomorianDb.health = health
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds, timestamp)
	}

	private getDifference(first: WfFomorian, second: WfFomorian): Partial<WfFomorian> {
		const diff = compare.getValueDifference(
				first,
				second,
				['start', 'end', 'type', 'endGoal', 'missionType', 'victimLocation', 'missionLocation']
			),
			goalRewardDiff = compare.getRewardDifference(first.goalRewards, second.goalRewards),
			missionRewardDiff = compare.getRewardDifference(first.missionRewards, second.missionRewards),
			randomRewardDiff = compare.getRandomRewardDifference(first.randomRewards, second.randomRewards),
			requiredItemsDiff = compare.getItemDifference(first.requiredItems, second.requiredItems)
		if (goalRewardDiff !== null) {
			diff.goalRewards = goalRewardDiff
		}
		if (missionRewardDiff !== null) {
			diff.missionRewards = missionRewardDiff
		}
		if (randomRewardDiff !== null) {
			diff.randomRewards = randomRewardDiff
		}
		if (requiredItemsDiff !== null) {
			diff.requiredItems = requiredItemsDiff
		}
		return diff
	}

	private cleanOld(oldIds: WfSet, timestamp: number): void {
		for (const id in oldIds) {
			const fomorianDb = this.dbTable!.get(id)
			if (fomorianDb) {
				history.end(fomorianDb.healthHistory, timestamp)
				fomorianDb.health = 0
				this.dbTable!.moveTmp(id)
			}
		}
	}
}