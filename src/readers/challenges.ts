import { getValueDifference, patch } from '../compare.js'
import { getDate, getId, getChallenge, getSyndicateName } from '../helpers.js'
import * as log from '../log.js'
import WfReader from './reader.js'

export default class ChallengeReader extends WfReader<WfChallengeSeason> {
	protected readonly dbTableId = 'challenges'

	protected isActive(challengeSeason: WfChallengeSeason, timestamp: number) {
		return challengeSeason.end >= timestamp
	}

	read(challengeSeasonInput: ChallengeSeasonEntry, timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading challenges')
		const oldIds = this.dbTable.getIdMap(),
			end = getDate(challengeSeasonInput.Expiry),
			id = challengeSeasonInput.AffiliationTag + end
		if (end >= timestamp && Array.isArray(challengeSeasonInput.ActiveChallenges)) {
			const challengeDb = this.dbTable.get(id),
				challenges: WfChallenge[] = [],
				challengeCurrent: WfChallengeSeason = {
					id: id,
					start: getDate(challengeSeasonInput.Activation),
					end: getDate(challengeSeasonInput.Expiry),
					syndicate: getSyndicateName(challengeSeasonInput.AffiliationTag),
					season: challengeSeasonInput.Season,
					phase: challengeSeasonInput.Phase,
					challenges: challenges,
				}
			for (const challengeInput of challengeSeasonInput.ActiveChallenges) {
				const challengeInfo = getChallenge(challengeInput.Challenge)
				challenges.push({
					id: getId(challengeInput),
					start: getDate(challengeInput.Activation),
					end: getDate(challengeInput.Expiry),
					daily: challengeInput.Daily === true,
					description: challengeInfo.description,
					xpAmount: challengeInfo.xpAmount,
				})
			}
			challenges.sort((a, b) => a.id.localeCompare(b.id))
			if (challengeDb) {
				const diff = this.getDifference(challengeDb, challengeCurrent)
				if (Object.keys(diff).length) {
					patch(challengeDb, diff)
					this.dbTable.updateTmp(id, diff)
					log.debug('Updating challenge %s', id)
				}
			}
			else {
				this.dbTable.add(id, challengeCurrent, true)
				log.debug('Found challenge %s', id)
			}
		}
		delete oldIds[id]
		this.cleanOld(oldIds)
	}

	private getDifference(first: WfChallengeSeason, second: WfChallengeSeason): Partial<WfChallenge> {
		const diff = getValueDifference(
			first,
			second,
			['start', 'end', 'syndicate', 'season', 'phase'],
		)
		if (first.challenges.length !== second.challenges.length) {
			diff.challenges = second.challenges
		}
		else {
			for (let challengeId = 0; challengeId < first.challenges.length; ++challengeId) {
				const challengeDiff = getValueDifference(
					first.challenges[challengeId],
					second.challenges[challengeId],
					['start', 'end', 'description', 'xpAmount'],
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
