import { getRandomRewardDifference, getValueDifference, patch } from '../compare.js'
import EntityRewards from '../entityrewards.js'
import { getLocation, getNodeFaction, getNodeMissionType, strToTime } from '../helpers.js'
import { getRandomRewards } from '../items.js'
import * as log from '../log.js'
import WfReader from './reader.js'

const missionPrefixLength = 'KuvaMission'.length

export default class KuvaSiphonReader extends WfReader<WfKuvaSiphon> {
	private readonly _entityRewards = new EntityRewards()
	protected readonly dbTableId = 'kuvasiphons'

	protected isActive(kuvamission: WfKuvaSiphon, timestamp: number) {
		return kuvamission.end >= timestamp
	}

	read(kuvamissionsInput: KuvalogEntry[], timestamp: number): void {
		if (!this.dbTable) {
			return
		}
		log.notice('Reading kuva siphons')
		kuvamissionsInput.sort((a, b) => Number(a.missiontype.substring(missionPrefixLength)) - Number(b.missiontype.substring(missionPrefixLength)))
		this._entityRewards.clear()
		const oldIds = this.dbTable.getIdMap()
		let missionIdx = 0
		for (const kuvamissionInput of kuvamissionsInput) {
			const start = strToTime(kuvamissionInput.start),
				end = strToTime(kuvamissionInput.end)
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
						location: getLocation(kuvamissionInput.solnode),
						faction: getNodeFaction(kuvamissionInput.solnode),
						missionType: getNodeMissionType(kuvamissionInput.solnode),
						flood: isKuvaFlood,
						rewards: getRandomRewards(rewardTableId, this._entityRewards),
					}
				if (kuvamissionDb) {
					const diff = this.getDifference(kuvamissionDb, kuvamissionCurrent)
					if (Object.keys(diff).length) {
						patch(kuvamissionDb, diff)
						this.dbTable.updateTmp(id, diff)
						log.debug('Updating kuva siphon %s', id)
					}
				}
				else {
					this.dbTable.add(id, kuvamissionCurrent, true)
					log.debug('Found kuva siphon %s', id)
				}
			}
			delete oldIds[id]
		}
		this.cleanOld(oldIds)
		this.dbTable.flush()
	}

	get entityRewards() { return this._entityRewards.rewards }

	private getDifference(first: WfKuvaSiphon, second: WfKuvaSiphon): Partial<WfKuvaSiphon> {
		const diff = getValueDifference(
				first,
				second,
				['start', 'end', 'location', 'faction', 'missionType', 'flood'],
			),
			rewardDiff = getRandomRewardDifference(first.rewards, second.rewards)
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
