import { getValueDifference, patch } from '../compare.js'
import { getDate, getId } from '../helpers.js'
import * as log from '../log.js'
import { translations } from '../tags.js'
import WfReader from './reader.js'

export default class NewsReader extends WfReader<WfNews> {
	protected readonly dbTableId = 'news'

	read(articlesInput: NewsEntry[]): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading news')
		const oldIds = this.dbTable.getIdMap()
		for (const articleInput of articlesInput) {
			const id = getId(articleInput),
				start = getDate(articleInput.Date)
			let text = ''
			for (const message of articleInput.Messages) {
				if (message.LanguageCode === 'en') {
					text = message.Message[0] === '/'
						? translations[message.Message] || message.Message
						: message.Message
					break
				}
			}
			const articleDb = this.dbTable.get(id),
				articleCurrent: WfNews = {
					id: id,
					start: start,
					text: text,
					link: this.getLink(articleInput),
				}
			if (articleInput.EventStartDate) {
				articleCurrent.eventStart = getDate(articleInput.EventStartDate)
			}
			if (articleInput.EventEndDate) {
				articleCurrent.eventEnd = getDate(articleInput.EventEndDate)
			}
			if (articleInput.EventLiveUrl) {
				articleCurrent.eventUrl = articleInput.EventLiveUrl
			}
			if (articleDb) {
				if (text === '') {
					this.dbTable.remove(id)
					log.debug('Removing news article %s', id)
				}
				else {
					const diff = this.getDifference(articleDb, articleCurrent)
					if (Object.keys(diff).length) {
						patch(articleDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating news article %s', id)
					}
				}
			}
			else if (text !== '') {
				this.dbTable.add(id, articleCurrent, true)
				log.debug('Found news article %s', id)
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	private getLink(articleInput: NewsEntry): string {
		if (articleInput.Prop) {
			return articleInput.Prop
		}
		if (!Array.isArray(articleInput.Links) || articleInput.Links.length === 0) {
			return ''
		}
		const link = articleInput.Links.find(findLink => findLink.LanguageCode === 'en')
		return typeof link?.Link === 'string' ? link.Link : ''
	}

	private getDifference(first: WfNews, second: WfNews): Partial<WfNews> {
		return getValueDifference(
			first,
			second,
			['start', 'text', 'link', 'eventStart', 'eventEnd', 'eventUrl'],
		)
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
