import { getRandomRewardDifference, getValueDifference, patch } from '../compare.js'
import EntityRewards from '../entityrewards.js'
import extraData from '../extradata.js'
import { getDate, getId, getLocation, getBountyRewardTableId, getSyndicateName } from '../helpers.js'
import { checkpoint, finalize, update } from '../history.js'
import { getRandomRewards, getRewardTableRotation } from '../items.js'
import * as log from '../log.js'
import WfReader from './reader.js'

export default class BountyReader extends WfReader<WfBounty> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'bounties'

	protected isActive(bounty: WfBounty, timestamp: number) {
		return (bounty.end === 0 || bounty.end >= timestamp)
			&& (bounty.health === undefined || bounty.health > 0)
	}

	read(bountiesInput: BountyEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading bounties')
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		for (const bounty of bountiesInput) {
			const id = getId(bounty),
				end = getDate(bounty.Expiry),
				health = Number(bounty.HealthPct || 0)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				let bountyDb = this.dbTable.get(id)
				const jobsCurrent: WfBountyJob[] = [],
					bountyCurrent: WfBounty = {
						id: id,
						start: getDate(bounty.Activation),
						end: end,
						syndicate: getSyndicateName(bounty.Tag),
						jobs: jobsCurrent,
					}
				if ('HealthPct' in bounty) {
					bountyCurrent.health = 1
					bountyCurrent.healthHistory = [[bountyCurrent.start, 1]]
				}
				if ('VictimNode' in bounty && bounty.VictimNode) {
					bountyCurrent.location = getLocation(bounty.VictimNode)
				}
				for (const job of bounty.Jobs) {
					const rewardTableId = getBountyRewardTableId(bounty.Tag, job.rewards),
						jobCurrent: WfBountyJob = {
							rewards: getRandomRewards(rewardTableId, this._entityRewards),
							minLevel: job.minEnemyLevel,
							maxLevel: job.maxEnemyLevel,
							xpAmounts: job.xpAmounts,
						},
						rewardTableRotation = getRewardTableRotation(rewardTableId)
					if (rewardTableRotation) {
						jobCurrent.rotation = rewardTableRotation
					}
					if (job.isVault) {
						jobCurrent.title = `Vault Level ${job.minEnemyLevel} - ${job.maxEnemyLevel}`
					}
					jobsCurrent.push(jobCurrent)
				}
				if (bountyDb) {
					const diff = this.getDifference(bountyDb, bountyCurrent)
					if (Object.keys(diff).length) {
						patch(bountyDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating bounty %s', id)
					}
				}
				else {
					bountyDb = bountyCurrent
					this.dbTable.add(id, bountyDb, true)
					log.debug('Found bounty %s', id)
				}
				if (bountyDb.healthHistory && bountyDb.health !== health) {
					const healthHistory = bountyDb.healthHistory
					update(health, healthHistory, timestamp)
					if (checkpoint(health, healthHistory, timestamp, 0.01)) {
						this.dbTable.updateTmp(id, {
							health: health,
							healthHistory: healthHistory,
						})
						log.debug('Updating bounty %s (%d -> %d)', id, bountyDb.health, health)
					}
					bountyDb.health = health
				}
			}
			delete oldIds[id]
		}

		for (const bounty of extraData.getData('bounties')) {
			const id = bounty.id
			let bountyDb = this.dbTable.get(id)
			const jobs: WfBountyJob[] = [],
				bountyCurrent: WfBounty = {
					id: id,
					start: 0,
					end: 0,
					syndicate: bounty.syndicate,
					jobs: jobs,
				}
			for (const job of bounty.jobs) {
				jobs.push({
					rewards: getRandomRewards(job.rewards, this._entityRewards),
					minLevel: job.minEnemyLevel,
					maxLevel: job.maxEnemyLevel,
					xpAmounts: job.xpAmounts,
					title: job.title,
				})
			}
			if (bountyDb) {
				const diff = this.getDifference(bountyDb, bountyCurrent)
				if (Object.keys(diff).length) {
					this.dbTable.moveTmp(id)
					this.dbTable.add(id, bountyCurrent, true)
					log.debug('Updating bounty %s', id)
				}
			}
			else {
				bountyDb = bountyCurrent
				this.dbTable.add(id, bountyDb, true)
				log.debug('Found bounty %s', id)
			}
			delete oldIds[id]
		}

		this.cleanOld(oldIds, timestamp)
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfBounty, second: WfBounty): Partial<WfBounty> {
		const diff = getValueDifference(
			first,
			second,
			['start', 'end', 'syndicate', 'location'],
		)
		if (first.jobs.length !== second.jobs.length) {
			diff.jobs = second.jobs
		}
		else {
			for (let jobIdx = 0; jobIdx < first.jobs.length; ++jobIdx) {
				const jobFirst = first.jobs[jobIdx],
					jobSecond = second.jobs[jobIdx],
					jobDiff = getValueDifference(
						jobFirst,
						jobSecond,
						['minLevel', 'maxLevel', 'title', 'rotation'],
					)
				if (
					Object.keys(jobDiff).length
					|| getRandomRewardDifference(jobFirst.rewards, jobSecond.rewards) !== null
					|| jobFirst.xpAmounts.join(' ') !== jobSecond.xpAmounts.join(' ')
				) {
					diff.jobs = second.jobs
					break
				}
			}
		}
		return diff
	}

	private cleanOld(oldIds: WfSet, timestamp: number): void {
		for (const id in oldIds) {
			const bountyDb = this.dbTable!.get(id)
			if (bountyDb) {
				if (bountyDb.healthHistory) {
					finalize(bountyDb.healthHistory, timestamp)
					bountyDb.health = 0
				}
				this.dbTable!.moveTmp(id)
			}
		}
	}
}
