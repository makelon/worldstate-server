import { getValueDifference, patch } from '../compare'
import EntityRewards from '../entityrewards'
import { getDate } from '../helpers'
import { getItem } from '../items'
import * as log from '../log'
import WfReader from './reader'

export default class DailyDealReader extends WfReader<WfDailyDeal> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'dailydeals'

	protected isActive(deal: WfDailyDeal, timestamp: number) {
		return deal.end >= timestamp
	}

	read(dealsInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s daily deals', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const dealInput of dealsInput) {
			const start = getDate(dealInput.Activation),
				end = getDate(dealInput.Expiry),
				id = start.toString(),
				sold = Number(dealInput.AmountSold)
			if (end >= timestamp) {
				let dealDb = this.dbTable.get(id)
				const dealCurrent: WfDailyDeal = {
					id: id,
					start: start,
					end: end,
					item: getItem(dealInput.StoreItem, this._entityRewards),
					price: dealInput.SalePrice,
					originalPrice: dealInput.OriginalPrice,
					stock: dealInput.AmountTotal,
					sold: sold
				}
				if (dealDb) {
					const diff = this.getDifference(dealDb, dealCurrent)
					if (Object.keys(diff).length) {
						patch(dealDb, diff)
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

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfDailyDeal, second: WfDailyDeal): Partial<WfDailyDeal> {
		const diff = getValueDifference(
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
