import h = require('../helpers')
import log = require('../log')

export default class SentientAnomalyReader implements WfReader {
	private dbTable!: WfDbTable<WfSentientAnomaly>
	private lastMission?: WfSentientAnomaly

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('sentient-anomalies')
	}

	read(missionInput: any, timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s sentient anomalies', this.platform)
		if (typeof missionInput !== 'string' || missionInput.length > 100) {
			return
		}
		try {
			missionInput = JSON.parse(missionInput)
		}
		catch (err) {
			return
		}
		if (missionInput.hasOwnProperty('sfn') && typeof missionInput.sfn === 'number') {
			this.cleanOld()
			const id = (missionInput.sfn as number).toString(),
				missionDb = this.dbTable.get(id),
				missionCurrent: WfSentientAnomaly = {
					id: id,
					start: timestamp,
					location: h.getLocation(`CrewBattleNode${id}`),
				}
			if (!missionDb) {
				this.dbTable.add(id, missionCurrent, true)
				this.lastMission = missionCurrent
				log.debug('Found sentient anomaly %s for %s', id, this.platform)
			}
		}
		else if (this.lastMission && !this.lastMission.end) {
			this.dbTable.updateTmp(this.lastMission.id, {
				end: timestamp,
			})
			this.lastMission.end = timestamp
			log.debug('Expired sentient anomaly %s for %s', this.lastMission.id, this.platform)
		}
	}

	get entityRewards() { return {} }

	private cleanOld(): void {
		for (const mission of this.dbTable!.getAll()) {
			if (mission.end) {
				this.dbTable!.moveTmp(mission.id)
				log.debug('Removed sentient anomaly %s for %s', mission.id, this.platform)
			}
		}
	}
}
