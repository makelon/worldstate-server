import compare = require('../compare')
import h = require('../helpers')
import log = require('../log')

export default class NewsReader implements WfReader {
	private dbTable!: WfDbTable<WfNews>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('news')
	}

	read(articlesInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s news', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const articleInput of articlesInput) {
			const id = h.getId(articleInput),
				start = h.getDate(articleInput.Date)
			let text: string = ''
			for (const message of articleInput.Messages) {
				if (message.LanguageCode == 'en') {
					text = message.Message
					break
				}
			}
			const articleDb = this.dbTable.get(id),
				articleCurrent: WfNews = {
					id: id,
					start: start,
					text: text,
					link: articleInput.Prop,
				}
			if (articleInput.EventStartDate) {
				articleCurrent.eventStart = h.getDate(articleInput.EventStartDate)
			}
			if (articleInput.EventEndDate) {
				articleCurrent.eventEnd = h.getDate(articleInput.EventEndDate)
			}
			if (articleInput.EventLiveUrl) {
				articleCurrent.eventUrl = articleInput.EventLiveUrl
			}
			if (articleDb) {
				const diff = this.getDifference(articleDb, articleCurrent)
				if (Object.keys(diff).length) {
					compare.patch(articleDb, diff)
					this.dbTable.updateTmp(id, diff)
					log.debug('Updating news article %s for %s', id, this.platform)
				}
			}
			else if (text !== '') {
				this.dbTable.add(id, articleCurrent, true)
				log.debug('Found news article %s for %s', id, this.platform)
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	get entityRewards() { return {} }

	private getDifference(first: WfNews, second: WfNews): Partial<WfNews> {
		return compare.getValueDifference(
			first,
			second,
			['start', 'text', 'link', 'eventStart', 'eventEnd', 'eventUrl']
		)
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
