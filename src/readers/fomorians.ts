import { getItemDifference, getRandomRewardDifference, getRewardDifference, getValueDifference, patch } from '../compare'
import EntityRewards from '../entityrewards'
import { getDate, getFomorianType, getId, getLocation, getMissionType } from '../helpers'
import { checkpoint, end, update } from '../history'
import { getItems, getRandomRewards, getRewards } from '../items'
import * as log from '../log'
import WfReader from './reader'

export default class FomorianReader extends WfReader<WfFomorian> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'fomorians'

	read(fomoriansInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s fomorians', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const fomorianInput of fomoriansInput) {
			const id = getId(fomorianInput),
				end = getDate(fomorianInput.Expiry),
				health = Number(fomorianInput.HealthPct)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				let fomorianDb = this.dbTable.get(id)
				const start = getDate(fomorianInput.Activation),
					mi = fomorianInput.MissionInfo,
					requiredItems = getItems(mi.requiredItems, this._entityRewards),
					fomorianCurrent: WfFomorian = {
						id: id,
						start: start,
						end: end,
						type: getFomorianType(fomorianInput.Faction),
						health: 1,
						healthHistory: [[start, 1]],
						endGoal: fomorianInput.Goal,
						missionType: getMissionType(mi.missionType),
						victimLocation: getLocation(fomorianInput.VictimNode),
						missionLocation: getLocation(mi.location),
						requiredItems: requiredItems
					}
				if (fomorianInput.Reward) {
					const rewards = getRewards(fomorianInput.Reward, this._entityRewards)
					if (rewards) {
						fomorianCurrent.goalRewards = rewards
					}
				}
				if (mi.missionReward) {
					if (mi.missionReward.randomizedItems) {
						const rewards = getRandomRewards(mi.missionReward.randomizedItems, this._entityRewards)
						if (rewards) {
							fomorianCurrent.randomRewards = rewards
						}
					}
					else {
						const rewards = getRewards(mi.missionReward, this._entityRewards)
						if (rewards) {
							fomorianCurrent.missionRewards = rewards
						}
					}
				}

				if (fomorianDb) {
					const diff = this.getDifference(fomorianDb, fomorianCurrent)
					if (Object.keys(diff).length) {
						patch(fomorianDb, diff)
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
					update(health, healthHistory, timestamp)
					if (checkpoint(health, healthHistory, timestamp, 0.01)) {
						this.dbTable.updateTmp(id, {
							health: health,
							healthHistory: healthHistory
						})
					}
					log.debug('Updating fomorian %s for %s (%d -> %d)', id, this.platform, fomorianDb.health, health)
					fomorianDb.health = health
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds, timestamp)
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfFomorian, second: WfFomorian): Partial<WfFomorian> {
		const diff = getValueDifference(
				first,
				second,
				['start', 'end', 'type', 'endGoal', 'missionType', 'victimLocation', 'missionLocation']
			),
			goalRewardDiff = getRewardDifference(first.goalRewards, second.goalRewards),
			missionRewardDiff = getRewardDifference(first.missionRewards, second.missionRewards),
			randomRewardDiff = getRandomRewardDifference(first.randomRewards, second.randomRewards),
			requiredItemsDiff = getItemDifference(first.requiredItems, second.requiredItems)
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
				end(fomorianDb.healthHistory, timestamp)
				fomorianDb.health = 0
				this.dbTable!.moveTmp(id)
			}
		}
	}
}
