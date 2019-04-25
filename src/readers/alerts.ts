import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')
import EntityRewards from '../entityrewards'

export default class AlertReader implements WfReader {
	private dbTable!: WfDbTable<WfAlert>
	private _entityRewards = new EntityRewards()

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('alerts')
	}

	read(alertsInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s alerts', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const alertInput of alertsInput) {
			const id = h.getId(alertInput),
				end = h.getDate(alertInput.Expiry)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				const alertDb = this.dbTable.get(id),
					mi = alertInput.MissionInfo,
					rewards = items.getRewards(mi.missionReward, this._entityRewards),
					alertCurrent: WfAlert = {
						id: id,
						start: h.getDate(alertInput.Activation),
						end: h.getDate(alertInput.Expiry),
						location: h.getLocation(mi.location),
						missionType: h.getMissionType(mi.missionType),
						faction: h.getFaction(mi.faction),
						minLevel: Number(mi.minEnemyLevel),
						maxLevel: Number(mi.maxEnemyLevel)
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
						compare.patch(alertDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating alert %s for %s', id, this.platform)
					}
				}
				else {
					this.dbTable.add(id, alertCurrent, true)
					log.debug('Found alert %s for %s', id, this.platform)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfAlert, second: WfAlert): Partial<WfAlert> {
		const diff = compare.getValueDifference(
				first,
				second,
				['start', 'end', 'location', 'faction', 'maxLevel', 'minLevel', 'missionType', 'missionLength']
			),
			rewardDiff = compare.getRewardDifference(first.rewards, second.rewards)
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
