import fs = require('fs')
import log = require('../log')
import config from '../config'
import compare = require('../compare')

export default class DayNightReader implements WfReader {
	private dbTable!: WfDbTable<WfDayNight>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('daynight')
		let dayNightInput: any
		if (config.dayNightPath) {
			try {
				dayNightInput = JSON.parse(fs.readFileSync(config.dayNightPath, 'utf8'))
			}
			catch (err) {
				if (err.code == 'ENOENT') {
					log.warning('Cannot open day cycle data: File %s does not exist', config.dayNightPath)
				}
				else {
					log.error(err.message)
				}
			}
		}
		const dayNightCycles = dayNightInput && dayNightInput[this.platform]
			? dayNightInput[this.platform]
			: []
		this.read(dayNightCycles, Math.floor(Date.now() / 1000))
	}

	read(dayNightCycles: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s day cycles', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const dayNightCycle of dayNightCycles) {
			const id = dayNightCycle.id,
				dayNightDb = this.dbTable.get(id),
				dayNightProcessed: WfDayNight = {
					id: id,
					start: dayNightCycle.start,
					length: dayNightCycle.length,
					dayStart: dayNightCycle.dayStart,
					dayEnd: dayNightCycle.dayEnd
				}
			if (dayNightDb) {
				const diff = this.getDifference(dayNightDb, dayNightProcessed)
				if (Object.keys(diff).length) {
					this.dbTable.moveTmp(id)
					this.dbTable.add(id, dayNightProcessed, true)
					log.debug('Updating day cycle %s for %s', id, this.platform)
				}
			}
			else {
				this.dbTable.add(id, dayNightProcessed, true)
				log.debug('Found day cycle %s for %s', id, this.platform)
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	private getDifference(first: WfDayNight, second: WfDayNight): Partial<WfDayNight> {
		return compare.getValueDifference(
			first,
			second,
			['start', 'length', 'dayStart', 'dayEnd']
		)
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}