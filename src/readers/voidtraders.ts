import { getValueDifference, getVoidTraderItemDifference, patch } from '../compare'
import EntityRewards from '../entityrewards'
import { getDate, getId, getLocation, getVoidTraderName } from '../helpers'
import { getItem } from '../items'
import * as log from '../log'
import WfReader from './reader'

export default class VoidTraderReader extends WfReader<WfVoidTrader> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'voidtraders'

	protected isActive(voidTrader: WfVoidTrader, timestamp: number) {
		return voidTrader.end >= timestamp
	}

	read(voidTradersInput: VoidTraderEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s void traders', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const voidTraderInput of voidTradersInput) {
			let id = getId(voidTraderInput)
			if (!id) {
				continue
			}
			const start = getDate(voidTraderInput.Activation),
				end = getDate(voidTraderInput.Expiry)
			id += start.toString()
			if (end >= timestamp) {
				const voidTraderDb = this.dbTable.get(id),
					voidTraderCurrent: WfVoidTrader = {
						id: id,
						start: start,
						end: end,
						name: getVoidTraderName(voidTraderInput.Character),
						location: getLocation(voidTraderInput.Node),
						active: false,
					}
				if (start <= timestamp) {
					const voidTraderItems: WfVoidTraderItem[] = [],
						itemsInput = voidTraderInput.Manifest || []
					voidTraderCurrent.items = voidTraderItems
					voidTraderCurrent.active = true
					for (const itemInput of itemsInput) {
						const item = getItem(itemInput.ItemType, this._entityRewards)
						voidTraderItems.push({
							name: item.name,
							type: item.type,
							ducats: Number(itemInput.PrimePrice),
							credits: Number(itemInput.RegularPrice),
						})
					}
				}
				if (voidTraderDb) {
					const diff = this.getDifference(voidTraderDb, voidTraderCurrent)
					if (Object.keys(diff).length) {
						patch(voidTraderDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating void trader %s for %s', id, this.platform)
					}
				}
				else {
					this.dbTable.add(id, voidTraderCurrent, true)
					log.debug('Found void trader %s for %s', id, this.platform)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfVoidTrader, second: WfVoidTrader): Partial<WfVoidTrader> {
		const diff = getValueDifference(
				first,
				second,
				['start', 'end', 'name', 'location', 'active'],
			),
			voidTraderItemDiff = getVoidTraderItemDifference(first.items, second.items)
		if (voidTraderItemDiff !== null) {
			diff.items = voidTraderItemDiff
		}
		return diff
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
