import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')
import EntityRewards from '../entityrewards'

export default class ArbitrationReader implements WfReader {
	private dbTable!: WfDbTable<WfArbitration>
	private _entityRewards = new EntityRewards()

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('arbitrations')
	}

	read(arbitrationsInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s arbitrations', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const arbitrationInput of arbitrationsInput) {
			const start = h.strToTime(arbitrationInput.start),
				end = h.strToTime(arbitrationInput.end)
			if (!start) {
				continue
			}
			const id = start.toString()
			if (end >= timestamp) {
				const arbitrationDb = this.dbTable.get(id),
					arbitrationCurrent: WfArbitration = {
						id: id,
						start: start,
						end: Math.min(end, start + 3600),
						location: h.getLocation(arbitrationInput.solnode),
						faction: h.getNodeFaction(arbitrationInput.solnode),
						missionType: h.getNodeMissionType(arbitrationInput.solnode),
						rewards: items.getRandomRewards('arbitrations', this._entityRewards),
					}
				if (arbitrationDb) {
					const diff = this.getDifference(arbitrationDb, arbitrationCurrent)
					if (Object.keys(diff).length) {
						compare.patch(arbitrationDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating arbitration %s for %s', id, this.platform)
					}
				}
				else {
					this.dbTable.add(id, arbitrationCurrent, true)
					log.debug('Found arbitration %s for %s', id, this.platform)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
		this.dbTable.flush()
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfArbitration, second: WfArbitration): Partial<WfArbitration> {
		const diff = compare.getValueDifference(
				first,
				second,
				['start', 'end', 'location', 'faction', 'missionType']
			),
			rewardDiff = compare.getRandomRewardDifference(first.rewards, second.rewards)
		if (rewardDiff !== null) {
			diff.rewards = rewardDiff
		}
		return diff
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
