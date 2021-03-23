import { patch, getValueDifference, getRandomRewardDifference } from '../compare'
import EntityRewards from '../entityrewards'
import { getAcolyteName, getId, getLocation } from '../helpers'
import { checkpoint, finalize, update } from '../history'
import { getRandomRewards } from '../items'
import * as log from '../log'
import WfReader from './reader'

export default class AcolyteReader extends WfReader<WfAcolyte> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'acolytes'

	protected isActive(acolyte: WfAcolyte) {
		return acolyte.health > 0
	}

	read(acolytesInput: AcolyteEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s acolytes', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const acolyteInput of acolytesInput) {
			const id = getId(acolyteInput)
			if (!id) {
				continue
			}
			const name = getAcolyteName(acolyteInput.LocTag),
				health = Number(acolyteInput.HealthPercent),
				discovered = acolyteInput.Discovered === true,
				location = getLocation(acolyteInput.LastDiscoveredLocation),
				rewards = getRandomRewards(name, this._entityRewards),
				acolyteCurrent: WfAcolyte = {
					id: id,
					name: name,
					health: health,
					healthHistory: [[timestamp, health]],
					discovered: false,
					location: location,
				}
			if (rewards) {
				acolyteCurrent.rewards = rewards
			}
			let acolyteDb = this.dbTable.get(id)
			if (acolyteDb) {
				const diff = this.getDifference(acolyteDb, acolyteCurrent)
				if (Object.keys(diff).length) {
					patch(acolyteDb, diff)
					this.dbTable.updateTmp(id, diff)
					log.debug('Updating acolyte %s for %s', id, this.platform)
				}
			}
			else {
				acolyteDb = acolyteCurrent
				this.dbTable.add(id, acolyteDb, true)
				log.debug('Found acolyte %s for %s', id, this.platform)
			}
			if (acolyteDb.discovered !== discovered) {
				acolyteDb.discovered = discovered
				acolyteDb.location = location
				this.dbTable.updateTmp(id, {
					discovered: discovered,
					location: location,
				})
				log.debug('Updating acolyte %s for %s (discovered -> %s)', id, this.platform, discovered ? 'true' : 'false')
			}
			if (acolyteDb.health !== health) {
				const healthHistory = acolyteDb.healthHistory
				update(health, healthHistory, timestamp)
				if (checkpoint(health, healthHistory, timestamp, 0.01)) {
					this.dbTable.updateTmp(id, {
						health: health,
						healthHistory: healthHistory,
					})
				}
				log.debug('Updating acolyte %s for %s (%d -> %d)', id, this.platform, acolyteDb.health, health)
				acolyteDb.health = health
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds, timestamp)
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfAcolyte, second: WfAcolyte): Partial<WfAcolyte> {
		const diff = getValueDifference(
				first,
				second,
				['name', 'location']
			),
			rewardDiff = getRandomRewardDifference(first.rewards, second.rewards)
		if (rewardDiff !== null) {
			diff.rewards = rewardDiff
		}
		return diff
	}

	private cleanOld(oldIds: WfSet, timestamp: number): void {
		for (const id in oldIds) {
			const acolyteDb = this.dbTable!.get(id)
			if (acolyteDb) {
				finalize(acolyteDb.healthHistory, timestamp)
				acolyteDb.health = 0
				this.dbTable!.moveTmp(id)
			}
		}
	}
}
