import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')
import history = require('../history')
import extraData from '../extradata'

export default class BountyReader implements WfReader {
	private dbTable!: WfDbTable<WfBounty>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('bounties')
	}

	read(bountiesInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s bounties', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const bounty of bountiesInput) {
			const id = h.getId(bounty),
				end = h.getDate(bounty.Expiry),
				health = Number(bounty.HealthPct || 0)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				let bountyDb = this.dbTable.get(id)
				const jobs: WfBountyJob[] = [],
					bountyCurrent: WfBounty = {
						id: id,
						start: h.getDate(bounty.Activation),
						end: end,
						syndicate: h.getSyndicateName(bounty.Tag),
						jobs: jobs
					}
				if ('HealthPct' in bounty) {
					bountyCurrent.health = 1
					bountyCurrent.healthHistory = [[bountyCurrent.start, 1]]
				}
				if ('VictimNode' in bounty) {
					bountyCurrent.location = h.getLocation(bounty.VictimNode)
				}
				for (const job of bounty.Jobs) {
					jobs.push({
						rewards: items.getBountyRewards(bounty.Tag, job.rewards),
						minLevel: job.minEnemyLevel,
						maxLevel: job.maxEnemyLevel,
						xpAmounts: job.xpAmounts
					})
				}
				if (bountyDb) {
					const diff = this.getDifference(bountyDb, bountyCurrent)
					if (Object.keys(diff).length) {
						compare.patch(bountyDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating bounty %s for %s', id, this.platform)
					}
				}
				else {
					bountyDb = bountyCurrent
					this.dbTable.add(id, bountyDb, true)
					log.debug('Found bounty %s for %s', id, this.platform)
				}
				if (bountyDb.healthHistory && bountyDb.health != health) {
					const healthHistory = bountyDb.healthHistory
					history.update(health, healthHistory, timestamp)
					if (history.checkpoint(health, healthHistory, timestamp, 0.01)) {
						this.dbTable.updateTmp(id, {
							health: health,
							healthHistory: healthHistory
						})
						log.debug('Updating bounty %s for %s (%f -> %f)', id, this.platform, bountyDb.health, health)
					}
					bountyDb.health = health
				}
			}
			delete oldIds[id]
		}

		for (const bounty of extraData.getData(this.platform, 'bounties')) {
			const id = bounty.id
			let bountyDb = this.dbTable.get(id)
			const jobs: WfBountyJob[] = [],
				bountyCurrent: WfBounty = {
					id: id,
					start: 0,
					end: 0,
					syndicate: bounty.syndicate,
					jobs: jobs
				}
			for (const job of bounty.jobs) {
				jobs.push({
					rewards: items.getRandomRewards(job.rewards),
					minLevel: job.minEnemyLevel,
					maxLevel: job.maxEnemyLevel,
					xpAmounts: job.xpAmounts,
					title: job.title
				})
			}
			if (bountyDb) {
				const diff = this.getDifference(bountyDb, bountyCurrent)
				if (Object.keys(diff).length) {
					this.dbTable.moveTmp(id)
					this.dbTable.add(id, bountyCurrent, true)
					log.debug('Updating bounty %s for %s', id, this.platform)
				}
			}
			else {
				bountyDb = bountyCurrent
				this.dbTable.add(id, bountyDb, true)
				log.debug('Found bounty %s for %s', id, this.platform)
			}
			delete oldIds[id]
		}

		this.cleanOld(oldIds, timestamp)
	}

	private getDifference(first: WfBounty, second: WfBounty): Partial<WfBounty> {
		const diff = compare.getValueDifference(
				first,
				second,
				['start', 'end', 'syndicate', 'location']
			)
		if (first.jobs.length != second.jobs.length) {
			diff.jobs = second.jobs
		}
		else {
			for (let jobIdx = 0; jobIdx < first.jobs.length; ++jobIdx) {
				const jobFirst = first.jobs[jobIdx],
					jobSecond = second.jobs[jobIdx]
				if (
					jobFirst.minLevel != jobSecond.minLevel
					|| jobFirst.maxLevel != jobSecond.maxLevel
					|| compare.getRandomRewardDifference(jobFirst.rewards, jobSecond.rewards) !== null
					|| jobFirst.xpAmounts.join(' ') != jobSecond.xpAmounts.join(' ')
					|| jobFirst.title != jobSecond.title
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
					history.end(bountyDb.healthHistory, timestamp)
					bountyDb.health = 0
				}
				this.dbTable!.moveTmp(id)
			}
		}
	}
}
