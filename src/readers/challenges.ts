import compare = require('../compare')
import h = require('../helpers')
import log = require('../log')

const challenges: {[id: string]: WfChallengeInfo} = {}

export default class ChallengeReader implements WfReader {
	private dbTable!: WfDbTable<WfChallengeSeason>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('challenges')
	}

	read(challengeSeasonInput: any, timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s challenges', this.platform)
		const oldIds = this.dbTable.getIdMap(),
			end = h.getDate(challengeSeasonInput.Expiry),
			id = challengeSeasonInput.AffiliationTag + end
		if (end >= timestamp && Array.isArray(challengeSeasonInput.ActiveChallenges)) {
			const challengeDb = this.dbTable.get(id),
				challenges: WfChallenge[] = [],
				challengeCurrent: WfChallengeSeason = {
					id: id,
					start: h.getDate(challengeSeasonInput.Activation),
					end: h.getDate(challengeSeasonInput.Expiry),
					syndicate: h.getSyndicateName(challengeSeasonInput.AffiliationTag),
					season: challengeSeasonInput.Season,
					phase: challengeSeasonInput.Phase,
					challenges: challenges
				}
			for (const challengeInput of challengeSeasonInput.ActiveChallenges) {
				const challengeInfo = h.getChallenge(challengeInput.Challenge)
				challenges.push({
					id: h.getId(challengeInput),
					start: h.getDate(challengeInput.Activation),
					end: h.getDate(challengeInput.Expiry),
					daily: challengeInput.Daily == true,
					description: challengeInfo.description,
					xpAmount: challengeInfo.xpAmount
				})
			}
			challenges.sort((a, b) => a.id.localeCompare(b.id))
			if (challengeDb) {
				const diff = this.getDifference(challengeDb, challengeCurrent)
				if (Object.keys(diff).length) {
					compare.patch(challengeDb, diff)
					this.dbTable.updateTmp(id, diff)
					log.debug('Updating challenge %s for %s', id, this.platform)
				}
			}
			else {
				this.dbTable.add(id, challengeCurrent, true)
				log.debug('Found challenge %s for %s', id, this.platform)
			}
		}
		delete oldIds[id]
		this.cleanOld(oldIds)
	}

	private getDifference(first: WfChallengeSeason, second: WfChallengeSeason): Partial<WfChallenge> {
		const diff = compare.getValueDifference(
			first,
			second,
			['start', 'end', 'syndicate', 'season', 'phase']
		)
		if (first.challenges.length != second.challenges.length) {
			diff.challenges = second.challenges
		}
		else {
			for (let challengeId = 0; challengeId < first.challenges.length; ++challengeId) {
				const challengeDiff = compare.getValueDifference(
					first.challenges[challengeId],
					second.challenges[challengeId],
					['start', 'end', 'description', 'xpAmount']
				)
				if (Object.keys(challengeDiff).length) {
					diff.challenges = second.challenges
					break
				}
			}
		}
		return diff
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
