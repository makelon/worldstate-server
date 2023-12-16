import { getValueDifference, patch } from '../compare.js'
import { getDate, getId, getLocation, getNodeFaction, getNodeMissionType, getVoidTier } from '../helpers.js'
import * as log from '../log.js'
import WfReader from './reader.js'

export default class VoidStormReader extends WfReader<WfVoidStorm> {
	protected readonly dbTableId = 'voidstorms'

	protected isActive(voidstorm: WfVoidStorm, timestamp: number) {
		return voidstorm.end >= timestamp
	}

	read(voidstormsInput: VoidStormEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s void storms', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const voidstormInput of voidstormsInput) {
			const id = getId(voidstormInput),
				end = getDate(voidstormInput.Expiry)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				const voidstormDb = this.dbTable.get(id),
					voidstormProcessed: WfVoidStorm = {
						id: id,
						start: getDate(voidstormInput.Activation),
						end: end,
						location: getLocation(voidstormInput.Node),
						faction: getNodeFaction(voidstormInput.Node),
						missionType: getNodeMissionType(voidstormInput.Node),
						tier: getVoidTier(voidstormInput.ActiveMissionTier),
					}
				if (voidstormDb) {
					const diff = this.getDifference(voidstormDb, voidstormProcessed)
					if (Object.keys(diff).length) {
						patch(voidstormDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating void storm %s for %s', id, this.platform)
					}
				}
				else {
					this.dbTable.add(id, voidstormProcessed, true)
					log.debug('Found void storm %s for %s', id, this.platform)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
	}

	private getDifference(first: WfVoidStorm, second: WfVoidStorm): Partial<WfVoidStorm> {
		return getValueDifference(
			first,
			second,
			['start', 'end', 'location', 'faction', 'missionType', 'tier'],
		)
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
