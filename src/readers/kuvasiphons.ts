import compare = require('../compare')
import h = require('../helpers')
import items = require('../items')
import log = require('../log')
import EntityRewards from '../entityrewards'

const missionPrefixLength = 'KuvaMission'.length

export default class KuvaSiphonReader implements WfReader {
	private dbTable!: WfDbTable<WfKuvaSiphon>
	private _entityRewards = new EntityRewards()

	constructor(
		private platform: string
	) {}

	start(db: WfDb): void {
		this.dbTable = db.getTable('kuvasiphons')
	}

	read(kuvamissionsInput: any[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading %s kuva siphons', this.platform)
		kuvamissionsInput.sort((a, b) => Number(a.missiontype.substr(missionPrefixLength)) - Number(b.missiontype.substr(missionPrefixLength)))
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		let missionIdx = 0
		for (const kuvamissionInput of kuvamissionsInput) {
			const start = h.strToTime(kuvamissionInput.start),
				end = h.strToTime(kuvamissionInput.end)
			if (!start) {
				continue
			}
			const id = kuvamissionInput.missiontype + start.toString()
			if (end >= timestamp) {
				++missionIdx
				const isKuvaFlood = (missionIdx % 6) === 0,
					rewardTableId = isKuvaFlood ? 'kuvaflood' : 'kuvasiphon',
					kuvamissionDb = this.dbTable.get(id),
					kuvamissionCurrent: WfKuvaSiphon = {
						id: id,
						start: start,
						end: Math.min(end, start + 3600),
						location: h.getLocation(kuvamissionInput.solnode),
						faction: h.getNodeFaction(kuvamissionInput.solnode),
						missionType: h.getNodeMissionType(kuvamissionInput.solnode),
						flood: isKuvaFlood,
						rewards: items.getRandomRewards(rewardTableId, this._entityRewards),
					}
				if (kuvamissionDb) {
					const diff = this.getDifference(kuvamissionDb, kuvamissionCurrent)
					if (Object.keys(diff).length) {
						compare.patch(kuvamissionDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating kuva siphon %s for %s', id, this.platform)
					}
				}
				else {
					this.dbTable.add(id, kuvamissionCurrent, true)
					log.debug('Found kuva siphon %s for %s', id, this.platform)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
		this.dbTable.flush()
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfKuvaSiphon, second: WfKuvaSiphon): Partial<WfKuvaSiphon> {
		const diff = compare.getValueDifference(
				first,
				second,
				['start', 'end', 'location', 'faction', 'missionType', 'flood']
			),
			rewardDiff = compare.getRandomRewardDifference(first.rewards, second.rewards)
		if (rewardDiff !== null) {
			diff.rewards = rewardDiff
		}
		return diff
	}

	private cleanOld(oldIds: WfSet): void {
		for (const id in oldIds) {
			this.dbTable!.moveTmp(id)
		}
	}
}
