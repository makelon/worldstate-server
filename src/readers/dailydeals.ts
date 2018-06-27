import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')

export default class DailyDealReader implements WfReader {
	private dbTable!: WfDbTable<WfDailyDeal>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('dailydeals')
	}

	read(dealsInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s daily deals', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const dealInput of dealsInput) {
			const start = h.getDate(dealInput.Activation),
				end = h.getDate(dealInput.Expiry),
				id = start.toString(),
				sold = Number(dealInput.AmountSold)
			if (end >= timestamp) {
				let dealDb = this.dbTable.get(id)
				const dealCurrent: WfDailyDeal = {
					id: id,
					start: start,
					end: end,
					item: items.getItem(dealInput.StoreItem),
					price: dealInput.SalePrice,
					originalPrice: dealInput.OriginalPrice,
					stock: dealInput.AmountTotal,
					sold: sold
				}
				if (dealDb) {
					const diff = this.getDifference(dealDb, dealCurrent)
					if (Object.keys(diff).length) {
						compare.patch(dealDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating daily deal %s for %s', id, this.platform)
					}
				}
				else {
					dealDb = dealCurrent
					this.dbTable.add(id, dealDb, true)
					log.debug('Found daily deal %s for %s', id, this.platform)
				}
				if (dealDb.sold != sold) {
					this.dbTable.updateTmp(id, {
						sold: sold
					})
					log.debug('Updating daily deal %s for %s (%d -> %d sold)', id, this.platform, dealDb.sold, sold)
					dealDb.sold = sold
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	private getDifference(first: WfDailyDeal, second: WfDailyDeal): Partial<WfDailyDeal> {
		const diff = compare.getValueDifference(
			first,
			second,
			['start', 'end', 'price', 'originalPrice', 'stock']
		)
		if (
			first.item.name != second.item.name
			|| first.item.type != second.item.type
		) {
			diff.item = second.item
		}
		return diff
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
