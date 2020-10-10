import { getRandomRewardDifference, getValueDifference, patch } from '../compare'
import EntityRewards from '../entityrewards'
import { getDate, getFaction, getId, getLocation, getMissionType } from '../helpers'
import { getRandomRewards } from '../items'
import * as log from '../log'
import { sortieBosses, sortieModifiers } from '../tags'
import WfReader from './reader'

export default class SortieReader extends WfReader<WfSortie> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'sorties'

	protected isActive(sortie: WfSortie, timestamp: number) {
		return sortie.end >= timestamp
	}

	read(sortiesInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s sorties', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const sortieInput of sortiesInput) {
			const id = getId(sortieInput),
				start = getDate(sortieInput.Activation),
				end = getDate(sortieInput.Expiry)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				const { faction, name: boss } = sortieBosses[sortieInput.Boss] || { faction: 'Unknown', name: sortieInput.Boss },
					missions: WfSortieMission[] = [],
					sortieDb = this.dbTable.get(id),
					sortieCurrent: WfSortie = {
						id: id,
						start: start,
						end: end,
						faction: getFaction(faction),
						bossName: boss,
						rewards: getRandomRewards(sortieInput.Reward, this._entityRewards),
						missions: missions
					}
				for (const missionInput of sortieInput.Variants) {
					missions.push({
						missionType: getMissionType(missionInput.missionType),
						modifier: sortieModifiers[missionInput.modifierType] || missionInput.modifierType,
						location: getLocation(missionInput.node)
					})
				}
				if (sortieDb) {
					const diff = this.getDifference(sortieDb, sortieCurrent)
					if (Object.keys(diff).length) {
						patch(sortieDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating sortie %s for %s', id, this.platform)
					}
				}
				else {
					this.dbTable.add(id, sortieCurrent, true)
					log.debug('Found sortie %s for %s', id, this.platform)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfSortie, second: WfSortie): Partial<WfSortie> {
		const diff = getValueDifference(
				first,
				second,
				['start', 'end', 'faction', 'bossName']
			),
			rewardDiff = getRandomRewardDifference(first.rewards, second.rewards)
		if (rewardDiff !== null) {
			diff.rewards = rewardDiff
		}
		if (first.missions.length != second.missions.length) {
			diff.missions = second.missions
		}
		else {
			for (let missionIdx = 0; missionIdx < first.missions.length; ++missionIdx) {
				const missionFirst = first.missions[missionIdx],
					missionSecond = second.missions[missionIdx]
				if (
					missionFirst.location != missionSecond.location
					|| missionFirst.missionType != missionSecond.missionType
					|| missionFirst.modifier != missionSecond.modifier
				) {
					diff.missions = second.missions
					break
				}
			}
		}
		return diff
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
