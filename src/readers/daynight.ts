import { getValueDifference } from '../compare.js'
import config from '../config.js'
import { parseJsonFile } from '../fshelpers.js'
import * as log from '../log.js'
import WfReader from './reader.js'

export default class DayNightReader extends WfReader<WfDayNight> {
	protected readonly dbTableId = 'daynight'

	start(db: WfDb): void {
		this.dbTable = db.getTable(this.dbTableId)
		const dayNightCycles = parseJsonFile<WfDayNight[]>(config.dayNightPath) || []
		this.read(dayNightCycles)
	}

	read(dayNightCycles: WfDayNight[]): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading day cycles')
		const oldIds = this.dbTable.getIdMap()
		for (const dayNightCycle of dayNightCycles) {
			const id = dayNightCycle.id,
				dayNightDb = this.dbTable.get(id),
				dayNightProcessed: WfDayNight = {
					id: id,
					start: dayNightCycle.start,
					length: dayNightCycle.length,
					dayStart: dayNightCycle.dayStart,
					dayEnd: dayNightCycle.dayEnd,
				}
			if (dayNightDb) {
				const diff = this.getDifference(dayNightDb, dayNightProcessed)
				if (Object.keys(diff).length) {
					this.dbTable.moveTmp(id)
					this.dbTable.add(id, dayNightProcessed, true)
					log.debug('Updating day cycle %s', id)
				}
			}
			else {
				this.dbTable.add(id, dayNightProcessed, true)
				log.debug('Found day cycle %s', id)
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	private getDifference(first: WfDayNight, second: WfDayNight): Partial<WfDayNight> {
		return getValueDifference(
			first,
			second,
			['start', 'length', 'dayStart', 'dayEnd'],
		)
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
