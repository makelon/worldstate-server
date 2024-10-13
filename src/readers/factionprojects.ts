import { getValueDifference, patch } from '../compare.js'
import { getFomorianFaction, getFomorianType } from '../helpers.js'
import { checkpoint, finalize, update } from '../history.js'
import * as log from '../log.js'
import WfReader from './reader.js'

export default class FactionProjectReader extends WfReader<WfFomorianProgress> {
	protected readonly dbTableId = 'factionprojects'

	read(projectsInput: FactionProjectEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading faction projects')
		const oldIds = this.dbTable.getIdMap()
		for (const projectIdx in projectsInput) {
			const projectInput = projectsInput[projectIdx],
				id = projectIdx.toString(),
				faction = getFomorianFaction(id)
			if (!faction) {
				continue
			}
			let projectDb = this.dbTable.get(id)
			const fomorianType = getFomorianType(faction),
				progress = Number(projectInput),
				projectCurrent: WfFomorianProgress = {
					id: id,
					type: fomorianType,
					progress: progress,
					progressHistory: [[timestamp, progress]],
				}
			if (projectDb) {
				const diff = this.getDifference(projectDb, projectCurrent)
				if (Object.keys(diff).length) {
					patch(projectDb, diff)
					this.dbTable.updateTmp(id, diff)
					log.debug('Updating faction project %s', id)
				}
			}
			else {
				projectDb = projectCurrent
				this.dbTable.add(id, projectDb, true)
				log.debug('Found faction project %s', id)
			}

			if (progress > projectDb.progress) {
				const progressHistory = projectDb.progressHistory
				update(progress, progressHistory, timestamp)
				if (checkpoint(progress, progressHistory, timestamp, 1)) {
					this.dbTable.updateTmp(id, {
						progress: progress,
						progressHistory: progressHistory,
					})
				}
				log.debug('Updating faction project %s (%d -> %d)', id, projectDb.progress, progress)
				projectDb.progress = progress
			}
			else if (progress < projectDb.progress * 0.9) {
				// Faction project was probably reset
				log.debug('Resetting faction project %s (%d -> %d)', id, projectDb.progress, progress)
				const prevProgress = projectDb.progressHistory[projectDb.progressHistory.length - 1]
				prevProgress[0] = Math.abs(prevProgress[0])
				this.dbTable.moveTmp(id)
				this.dbTable.add(id, {
					id: id,
					type: fomorianType,
					progress: progress,
					progressHistory: [[timestamp, progress]],
				}, true)
			}
			else if (progress < projectDb.progress) {
				log.notice('Ignoring reverse progress in faction project %s (%d -> %d)', id, projectDb.progress, progress)
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds, timestamp)
	}

	private getDifference(first: WfFomorianProgress, second: WfFomorianProgress): Partial<WfFomorianProgress> {
		return getValueDifference(
			first,
			second,
			['type'],
		)
	}

	private cleanOld(oldIds: WfSet, timestamp: number): void {
		for (const id in oldIds) {
			const projectDb = this.dbTable!.get(id)
			if (projectDb) {
				finalize(projectDb.progressHistory, timestamp)
				projectDb.progress = 0
				this.dbTable!.moveTmp(id)
			}
		}
	}
}
