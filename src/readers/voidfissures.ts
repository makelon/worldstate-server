import compare = require('../compare')
import h = require('../helpers')
import log = require('../log')

export default class VoidFissureReader implements WfReader {
	private dbTable!: WfDbTable<WfVoidFissure>

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('fissures')
	}

	read(fissuresInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s void fissures', this.platform)
		const oldIds = this.dbTable.getIdMap()
		for (const fissureInput of fissuresInput) {
			const id = h.getId(fissureInput),
				end = h.getDate(fissureInput.Expiry)
			if (!id) {
				continue
			}
			if (end >= timestamp) {
				const fissureDb = this.dbTable.get(id),
					fissureProcessed: WfVoidFissure = {
						id: id,
						start: h.getDate(fissureInput.Activation),
						end: end,
						location: h.getLocation(fissureInput.Node),
						faction: h.getNodeFaction(fissureInput.Node),
						missionType: h.getNodeMissionType(fissureInput.Node),
						tier: h.getVoidTier(fissureInput.Modifier)
					}
				if (fissureDb) {
					const diff = this.getDifference(fissureDb, fissureProcessed)
					if (Object.keys(diff).length) {
						compare.patch(fissureDb, diff)
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
		return compare.getValueDifference(
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
