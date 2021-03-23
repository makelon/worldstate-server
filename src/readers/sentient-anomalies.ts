import { getLocation } from '../helpers'
import * as log from '../log'
import WfReader from './reader'

export default class SentientAnomalyReader extends WfReader<WfSentientAnomaly> {
	private lastMission?: WfSentientAnomaly
	protected readonly dbTableId = 'sentient-anomalies'

	read(missionInput: string, timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s sentient anomalies', this.platform)
		let parsedMissionInput: { sfn: number }
		if (typeof missionInput !== 'string' || missionInput.length > 100) {
			return
		}
		try {
			parsedMissionInput = JSON.parse(missionInput)
		}
		catch (err) {
			return
		}
		if ('sfn' in parsedMissionInput && typeof parsedMissionInput.sfn === 'number') {
			this.cleanOld()
			const id = (parsedMissionInput.sfn as number).toString(),
				missionDb = this.dbTable.get(id),
				missionCurrent: WfSentientAnomaly = {
					id: id,
					start: timestamp,
					location: getLocation(`CrewBattleNode${id}`),
				}
			if (!missionDb) {
				if (this.lastMission) {
					this.lastMission.end = timestamp
					this.dbTable.moveTmp(this.lastMission.id)
					log.debug('Expired and removed sentient anomaly %s for %s', this.lastMission.id, this.platform)
				}
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

	private cleanOld(): void {
		for (const mission of this.dbTable!.getAll()) {
			if (mission.end || !this.lastMission) {
				this.dbTable!.moveTmp(mission.id)
				log.debug('Removed sentient anomaly %s for %s', mission.id, this.platform)
			}
		}
	}
}
