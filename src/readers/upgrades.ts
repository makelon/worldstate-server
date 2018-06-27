import compare = require('../compare')
import h = require('../helpers')
import log = require('../log')
import tags = require('../tags')

export default class UpgradeReader implements WfReader {
	private dbTable!: WfDbTable<WfUpgrade>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('upgrades')
	}

	read(upgradeInputs: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s upgrades', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const upgradeInput of upgradeInputs) {
			const id = h.getId(upgradeInput),
				end = h.getDate(upgradeInput.ExpiryDate)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				const upgradeDb = this.dbTable.get(id),
					upgradeProcessed: WfUpgrade = {
						id: id,
						start: h.getDate(upgradeInput.Activation),
						end: end,
						type: tags.upgradeTypes[upgradeInput.UpgradeType] || upgradeInput.UpgradeType,
						opType: upgradeInput.OperationType,
						value: Number(upgradeInput.Value)
					}
				if (upgradeDb) {
					const diff = this.getDifference(upgradeDb, upgradeProcessed)
					if (Object.keys(diff).length) {
						compare.patch(upgradeDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating upgrade %s for %s', id, this.platform)
					}
				}
				else {
					this.dbTable.add(id, upgradeProcessed, true)
					log.debug('Found upgrade %s for %s', id, this.platform)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	private getDifference(first: WfUpgrade, second: WfUpgrade): Partial<WfUpgrade> {
		return compare.getValueDifference(
			first,
			second,
			['start', 'end', 'type', 'opType', 'value']
		)
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
