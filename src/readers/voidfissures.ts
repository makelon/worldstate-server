import { getValueDifference, patch } from '../compare'
import { getDate, getId, getLocation, getNodeFaction, getNodeMissionType, getVoidTier } from '../helpers'
import * as log from '../log'
import WfReader from './reader'

export default class VoidFissureReader extends WfReader<WfVoidFissure> {
	protected readonly dbTableId = 'fissures'

	protected isActive(fissure: WfVoidFissure, timestamp: number) {
		return fissure.end >= timestamp
	}

	read(fissuresInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s void fissures', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const fissureInput of fissuresInput) {
			const id = getId(fissureInput),
				end = getDate(fissureInput.Expiry)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				const fissureDb = this.dbTable.get(id),
					fissureProcessed: WfVoidFissure = {
						id: id,
						start: getDate(fissureInput.Activation),
						end: end,
						location: getLocation(fissureInput.Node),
						faction: getNodeFaction(fissureInput.Node),
						missionType: getNodeMissionType(fissureInput.Node),
						tier: getVoidTier(fissureInput.Modifier)
					}
				if (fissureDb) {
					const diff = this.getDifference(fissureDb, fissureProcessed)
					if (Object.keys(diff).length) {
						patch(fissureDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating void fissure %s for %s', id, this.platform)
					}
				}
				else {
					this.dbTable.add(id, fissureProcessed, true)
					log.debug('Found void fissure %s for %s', id, this.platform)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	private getDifference(first: WfVoidFissure, second: WfVoidFissure): Partial<WfVoidFissure> {
		return getValueDifference(
			first,
			second,
			['start', 'end', 'location', 'faction', 'missionType', 'tier']
		)
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
