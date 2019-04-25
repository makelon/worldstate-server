import compare = require('../compare')
import h = require('../helpers')
import log = require('../log')
import history = require('../history')

export default class AcolyteReader implements WfReader {
	private dbTable!: WfDbTable<WfAcolyte>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('acolytes')
	}

	read(acolytesInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s acolytes', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const acolyteInput of acolytesInput) {
			const id = h.getId(acolyteInput),
				name = h.getAcolyteName(acolyteInput.LocTag),
				health = Number(acolyteInput.HealthPercent),
				discovered = acolyteInput.Discovered == true,
				location = h.getLocation(acolyteInput.LastDiscoveredLocation)
			if (!id) {
				continue
			}
			let acolyteDb = this.dbTable.get(id)
			const acolyteCurrent: WfAcolyte = {
				id: id,
				name: name,
				health: health,
				healthHistory: [[timestamp, health]],
				discovered: false,
				location: location
			}
			if (acolyteDb) {
				const diff = this.getDifference(acolyteDb, acolyteCurrent)
				if (Object.keys(diff).length) {
					compare.patch(acolyteDb, diff)
					this.dbTable.updateTmp(id, diff)
					log.debug('Updating acolyte %s for %s', id, this.platform)
				}
			}
			else {
				acolyteDb = acolyteCurrent
				this.dbTable.add(id, acolyteDb, true)
				log.debug('Found acolyte %s for %s', id, this.platform)
			}
			if (acolyteDb.discovered != discovered) {
				acolyteDb.discovered = discovered
				acolyteDb.location = location
				this.dbTable.updateTmp(id, {
					discovered: discovered,
					location: location
				})
				log.debug('Updating acolyte %s for %s (discovered -> s)', id, this.platform, discovered ? 'true' : 'false')
			}
			if (acolyteDb.health != health) {
				const healthHistory = acolyteDb.healthHistory
				history.update(health, healthHistory, timestamp)
				if (history.checkpoint(health, healthHistory, timestamp, 0.01)) {
					this.dbTable.updateTmp(id, {
						health: health,
						healthHistory: healthHistory
					})
				}
				log.debug('Updating acolyte %s for %s (%f -> %f)', id, this.platform, acolyteDb.health, health)
				acolyteDb.health = health
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds, timestamp)
	}

	get entityRewards() { return {} }

	private getDifference(first: WfAcolyte, second: WfAcolyte): Partial<WfAcolyte> {
		return compare.getValueDifference(
			first,
			second,
			['name', 'location']
		)
	}

	private cleanOld(oldIds: WfSet, timestamp: number): void {
		for (const id in oldIds) {
			const acolyteDb = this.dbTable!.get(id)
			if (acolyteDb) {
				history.end(acolyteDb.healthHistory, timestamp)
				acolyteDb.health = 0
				this.dbTable!.moveTmp(id)
			}
		}
	}
}
