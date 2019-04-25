import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')
import history = require('../history')
import EntityRewards from '../entityrewards'

export default class InvasionReader implements WfReader {
	private dbTable!: WfDbTable<WfInvasion>
	private _entityRewards = new EntityRewards()

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('invasions')
	}

	read(invasions: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s invasions', this.platform)
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const invasion of invasions) {
			const id = h.getId(invasion),
				start = h.getDate(invasion.Activation),
				score = Number(invasion.Count)
			if (!id || !start) {
				continue
			}
			let invasionDb = this.dbTable.get(id)
			const location = h.getLocation(invasion.Node),
				endScore = Number(invasion.Goal),
				// Reversed because xMissionInfo.faction is the mission's opposing faction
				factionAttacker = h.getFaction(invasion.DefenderMissionInfo.faction),
				factionDefender = h.getFaction(invasion.AttackerMissionInfo.faction),
				invasionCurrent: WfInvasion = {
					id: id,
					start: start,
					endScore: endScore,
					location: h.getLocation(invasion.Node),
					score: 0,
					scoreHistory: [[start, 0]],
					factionAttacker: factionAttacker,
					factionDefender: factionDefender
				}
			if (invasion.AttackerReward) {
				const rewards = items.getRewards(invasion.AttackerReward, this._entityRewards)
				if (rewards) {
					invasionCurrent.rewardsAttacker = rewards
				}
			}
			if (invasion.DefenderReward) {
				const rewards = items.getRewards(invasion.DefenderReward, this._entityRewards)
				if (rewards) {
					invasionCurrent.rewardsDefender = rewards
				}
			}
			if (invasionDb) {
				const diff = this.getDifference(invasionDb, invasionCurrent)
				if (Object.keys(diff).length) {
					compare.patch(invasionDb, diff)
					this.dbTable.updateTmp(id, diff)
					log.debug('Updating invasion %s for %s', id, this.platform)
				}
			}
			else {
				invasionDb = invasionCurrent
				this.dbTable.add(id, invasionDb, true)
				log.debug('Found invasion %s for %s', id, this.platform)
			}

			if (invasionDb.score != score) {
				const scoreHistory = invasionDb.scoreHistory
				let lastHist = scoreHistory[scoreHistory.length - 1],
					updateDb = false
				const prevScore = lastHist[1],
					prevTime = Math.abs(lastHist[0]),
					scoreDiff = score - prevScore,
					prevScoreDiff = scoreHistory.length > 1 ? prevScore - scoreHistory[scoreHistory.length - 2][1] : 0,
					isDirectionChange = (scoreDiff < 0 && prevScoreDiff > 0) || (scoreDiff > 0 && prevScoreDiff < 0),
					isLeaderChange = (score <= 0 && prevScore > 0) || (score >= 0 && prevScore < 0)
				if (isDirectionChange && Math.abs(scoreDiff) / invasionDb.endScore >= 0.001) {
					// Record the point of the local maximum if the score difference is significant
					lastHist[0] = prevTime
					lastHist = [-timestamp, score]
					scoreHistory.push(lastHist)
					updateDb = true
				}
				if (isLeaderChange) {
					// Interpolate to find point where faction advantage changes
					// ylerp = xlerp*dy/dx + y0, ylerp = 0 => xlerp = -dx*y0/dy
					lastHist[0] = Math.round(prevTime - (timestamp - prevTime) * prevScore / scoreDiff)
					lastHist[1] = 0
					lastHist = [-timestamp, score]
					scoreHistory.push(lastHist)
					updateDb = true
				}
				history.update(score, scoreHistory, timestamp)
				if (
					Math.abs(score - scoreHistory[scoreHistory.length - 2][1]) / invasionDb.endScore >= 0.01
					|| Math.abs(score) >= invasionDb.endScore
				) {
					scoreHistory[scoreHistory.length - 1][0] = timestamp
					updateDb = true
				}
				if (updateDb) {
					this.dbTable.updateTmp(id, {
						score: score,
						scoreHistory: scoreHistory
					})
				}
				log.debug('Updating invasion %s for %s (%f -> %f)', id, this.platform, invasionDb.score, score)
				invasionDb.score = score
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds, timestamp)
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfInvasion, second: WfInvasion): Partial<WfInvasion> {
		const diff = compare.getValueDifference(
				first,
				second,
				['start', 'endScore', 'location', 'factionAttacker', 'factionDefender']
			),
			rewardDiffAttacker = compare.getRewardDifference(first.rewardsAttacker, second.rewardsAttacker),
			rewardDiffDefender = compare.getRewardDifference(first.rewardsDefender, second.rewardsDefender)
		if (rewardDiffAttacker !== null) {
			diff.rewardsAttacker = rewardDiffAttacker
		}
		if (rewardDiffDefender !== null) {
			diff.rewardsDefender = rewardDiffDefender
		}
		return diff
	}

	private cleanOld(oldIds: WfSet, timestamp: number): void {
		for (const id in oldIds) {
			const dbInvasion = this.dbTable!.get(id)
			if (dbInvasion) {
				const scoreHistory = dbInvasion.scoreHistory
				if (scoreHistory[scoreHistory.length - 1][0] < 0) {
					// Remove last history entry if it's temporary
					scoreHistory.pop()
				}
				const prevScore = scoreHistory[scoreHistory.length - 1][1],
					score = prevScore > 0 ? dbInvasion.endScore : -dbInvasion.endScore
				if (score != prevScore) {
					// Add final entry if necessary
					scoreHistory.push([timestamp, score])
					dbInvasion.score = score
				}
				this.dbTable!.moveTmp(id)
			}
		}
	}
}
