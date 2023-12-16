import { getValueDifference, getRandomRewardDifference, patch } from '../compare.js'
import EntityRewards from '../entityrewards.js'
import { getLocation, getNodeFaction, getNodeMissionType, strToTime } from '../helpers.js'
import { getRandomRewards } from '../items.js'
import * as log from '../log.js'
import WfReader from './reader.js'

export default class ArbitrationReader extends WfReader<WfArbitration> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'arbitrations'

	protected isActive(arbitration: WfArbitration, timestamp: number) {
		return arbitration.end >= timestamp
	}

	read(arbitrationsInput: KuvalogEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s arbitrations', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const arbitrationInput of arbitrationsInput) {
			const start = strToTime(arbitrationInput.start),
				end = strToTime(arbitrationInput.end)
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
						location: getLocation(arbitrationInput.solnode),
						faction: getNodeFaction(arbitrationInput.solnode),
						missionType: getNodeMissionType(arbitrationInput.solnode),
						rewards: getRandomRewards('arbitrations', this._entityRewards),
					}
				if (arbitrationDb) {
					const diff = this.getDifference(arbitrationDb, arbitrationCurrent)
					if (Object.keys(diff).length) {
						patch(arbitrationDb, diff)
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
		const diff = getValueDifference(
				first,
				second,
				['start', 'end', 'location', 'faction', 'missionType'],
			),
			rewardDiff = getRandomRewardDifference(first.rewards, second.rewards)
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
