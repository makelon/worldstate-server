import { getValueDifference, patch } from '../compare'
import { getDate, getId } from '../helpers'
import * as log from '../log'
import { upgradeTypes } from '../tags'
import WfReader from './reader'

export default class UpgradeReader extends WfReader<WfUpgrade> {
	protected readonly dbTableId = 'upgrades'

	protected isActive(upgrade: WfUpgrade, timestamp: number) {
		return upgrade.end >= timestamp
	}

	read(upgradeInputs: UpgradeEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s upgrades', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const upgradeInput of upgradeInputs) {
			const id = getId(upgradeInput),
				end = getDate(upgradeInput.ExpiryDate)
			if (!id || ('Nodes' in upgradeInput)) {
				continue
			}
			if (end >= timestamp) {
				const upgradeDb = this.dbTable.get(id),
					upgradeProcessed: WfUpgrade = {
						id: id,
						start: getDate(upgradeInput.Activation),
						end: end,
						type: upgradeTypes[upgradeInput.UpgradeType] || upgradeInput.UpgradeType,
						opType: upgradeInput.OperationType,
						value: Number(upgradeInput.Value)
					}
				if (upgradeDb) {
					const diff = this.getDifference(upgradeDb, upgradeProcessed)
					if (Object.keys(diff).length) {
						patch(upgradeDb, diff)
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
		return getValueDifference(
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
