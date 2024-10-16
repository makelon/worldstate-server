import { getRewardDifference, getValueDifference, patch } from '../compare.js'
import EntityRewards from '../entityrewards.js'
import { getDate, getFaction, getId, getLocation, getMissionType } from '../helpers.js'
import { getRewards } from '../items.js'
import * as log from '../log.js'
import WfReader from './reader.js'

export default class AlertReader extends WfReader<WfAlert> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'alerts'

	protected isActive(alert: WfAlert, timestamp: number) {
		return alert.end >= timestamp
	}

	read(alertsInput: AlertEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading alerts')
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const alertInput of alertsInput) {
			const id = getId(alertInput),
				end = getDate(alertInput.Expiry)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				const alertDb = this.dbTable.get(id),
					mi = alertInput.MissionInfo,
					rewards = getRewards(mi.missionReward, this._entityRewards),
					alertCurrent: WfAlert = {
						id: id,
						start: getDate(alertInput.Activation),
						end: getDate(alertInput.Expiry),
						location: getLocation(mi.location),
						missionType: getMissionType(mi.missionType),
						faction: getFaction(mi.faction),
						minLevel: Number(mi.minEnemyLevel),
						maxLevel: Number(mi.maxEnemyLevel),
					}
				if (rewards) {
					alertCurrent.rewards = rewards
				}
				if (mi.maxWaveNum) {
					alertCurrent.missionLength = mi.maxWaveNum
				}
				if (alertDb) {
					const diff = this.getDifference(alertDb, alertCurrent)
					if (Object.keys(diff).length) {
						patch(alertDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating alert %s', id)
					}
				}
				else {
					this.dbTable.add(id, alertCurrent, true)
					log.debug('Found alert %s', id)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfAlert, second: WfAlert): Partial<WfAlert> {
		const diff = getValueDifference(
				first,
				second,
				['start', 'end', 'location', 'faction', 'maxLevel', 'minLevel', 'missionType', 'missionLength'],
			),
			rewardDiff = getRewardDifference(first.rewards, second.rewards)
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
