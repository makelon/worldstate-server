import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')
import tags = require('../tags')

export default class SortieReader implements WfReader {
	private dbTable!: WfDbTable<WfSortie>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('sorties')
	}

	read(sortiesInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s sorties', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const sortieInput of sortiesInput) {
			const id = h.getId(sortieInput),
				start = h.getDate(sortieInput.Activation),
				end = h.getDate(sortieInput.Expiry)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				const { faction, name: boss } = tags.sortieBosses[sortieInput.Boss] || { faction: 'Unknown', name: sortieInput.Boss },
					missions: WfSortieMission[] = [],
					sortieDb = this.dbTable.get(id),
					sortieCurrent: WfSortie = {
						id: id,
						start: start,
						end: end,
						faction: h.getFaction(faction),
						bossName: boss,
						rewards: items.getRandomRewards(sortieInput.Reward),
						missions: missions
					}
				for (const missionInput of sortieInput.Variants) {
					missions.push({
						missionType: h.getMissionType(missionInput.missionType),
						modifier: tags.sortieModifiers[missionInput.modifierType] || missionInput.modifierType,
						location: h.getLocation(missionInput.node)
					})
				}
				if (sortieDb) {
					const diff = this.getDifference(sortieDb, sortieCurrent)
					if (Object.keys(diff).length) {
						compare.patch(sortieDb, diff)
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

	private getDifference(first: WfSortie, second: WfSortie): Partial<WfSortie> {
		const diff = compare.getValueDifference(
				first,
				second,
				['start', 'end', 'faction', 'bossName']
			),
			rewardDiff = compare.getRandomRewardDifference(first.rewards, second.rewards)
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
