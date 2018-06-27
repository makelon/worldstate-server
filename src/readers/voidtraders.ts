import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')

export default class VoidTraderReader implements WfReader {
	private dbTable!: WfDbTable<WfVoidTrader>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('voidtraders')
	}

	read(voidTradersInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s void traders', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const voidTraderInput of voidTradersInput) {
			let id = h.getId(voidTraderInput)
			if (!id) {
				continue
			}
			const start = h.getDate(voidTraderInput.Activation),
				end = h.getDate(voidTraderInput.Expiry)
			id += start.toString()
			if (end >= timestamp) {
				const voidTraderDb = this.dbTable.get(id),
					voidTraderCurrent: WfVoidTrader = {
						id: id,
						start: start,
						end: end,
						name: h.getVoidTraderName(voidTraderInput.Character),
						location: h.getLocation(voidTraderInput.Node),
						active: false
					}
				if (start <= timestamp) {
					const voidTraderItems: WfVoidTraderItem[] = [],
						itemsInput = voidTraderInput.Manifest || []
					voidTraderCurrent.items = voidTraderItems
					voidTraderCurrent.active = true
					for (const itemInput of itemsInput) {
						const item = items.getItem(itemInput.ItemType)
						voidTraderItems.push({
							name: item.name,
							type: item.type,
							ducats: Number(itemInput.PrimePrice),
							credits: Number(itemInput.RegularPrice)
						})
					}
				}
				if (voidTraderDb) {
					const diff = this.getDifference(voidTraderDb, voidTraderCurrent)
					if (Object.keys(diff).length) {
						compare.patch(voidTraderDb, diff)
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

	private getDifference(first: WfVoidTrader, second: WfVoidTrader): Partial<WfVoidTrader> {
		const diff = compare.getValueDifference(
				first,
				second,
				['start', 'end', 'name', 'location', 'active']
			),
			voidTraderItemDiff = compare.getVoidTraderItemDifference(first.items, second.items)
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
