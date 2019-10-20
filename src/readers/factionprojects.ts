import compare = require('../compare')
import h = require('../helpers')
import log = require('../log')
import history = require('../history')

export default class FactionProjectReader implements WfReader {
	private dbTable!: WfDbTable<WfFomorianProgress>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('factionprojects')
	}

	read(projectsInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s faction projects', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const projectIdx in projectsInput) {
			const projectInput = projectsInput[projectIdx],
				id = projectIdx.toString(),
				faction = h.getFomorianFaction(id)
			if (!faction) {
				continue
			}
			let projectDb = this.dbTable.get(id)
			const fomorianType = h.getFomorianType(faction),
				progress = Number(projectInput),
				projectCurrent: WfFomorianProgress = {
					id: id,
					type: fomorianType,
					progress: progress,
					progressHistory: [[timestamp, progress]]
				}
			if (projectDb) {
				const diff = this.getDifference(projectDb, projectCurrent)
				if (Object.keys(diff).length) {
					compare.patch(projectDb, diff)
					this.dbTable.updateTmp(id, diff)
					log.debug('Updating faction project %s for %s', id, this.platform)
				}
			}
			else {
				projectDb = projectCurrent
				this.dbTable.add(id, projectDb, true)
				log.debug('Found faction project %s for %s', id, this.platform)
			}

			if (progress > projectDb.progress) {
				const progressHistory = projectDb.progressHistory
				history.update(progress, progressHistory, timestamp)
				if (history.checkpoint(progress, progressHistory, timestamp, 1)) {
					this.dbTable.updateTmp(id, {
						progress: progress,
						progressHistory: progressHistory
					})
				}
				log.debug('Updating faction project %s for %s (%d -> %d)', id, this.platform, projectDb.progress, progress)
				projectDb.progress = progress
			}
			else if (progress < projectDb.progress * 0.9) {
				// Faction project was probably reset
				log.debug('Resetting faction project %s for %s (%d -> %d)', id, this.platform, projectDb.progress, progress)
				const prevProgress = projectDb.progressHistory[projectDb.progressHistory.length - 1]
				prevProgress[0] = Math.abs(prevProgress[0])
				this.dbTable.moveTmp(id)
				this.dbTable.add(id, {
					id: id,
					type: fomorianType,
					progress: progress,
					progressHistory: [[timestamp, progress]]
				}, true)
			}
			else if (progress < projectDb.progress) {
				log.notice('Ignoring reverse progress in faction project %s for %s (%d -> %d)', id, this.platform, projectDb.progress, progress);
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds, timestamp)
	}

	get entityRewards() { return {} }

	private getDifference(first: WfFomorianProgress, second: WfFomorianProgress): Partial<WfFomorianProgress> {
		return compare.getValueDifference(
			first,
			second,
			['type']
		)
	}

	private cleanOld(oldIds: WfSet, timestamp: number): void {
		for (const id in oldIds) {
			const projectDb = this.dbTable!.get(id)
			if (projectDb) {
				history.end(projectDb.progressHistory, timestamp)
				projectDb.progress = 0
				this.dbTable!.moveTmp(id)
			}
		}
	}
}
