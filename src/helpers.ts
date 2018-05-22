import tags = require('./tags')

// Convert number to a string with leading zeros. Helper function for date/time formatting
const padValues = ['', '0', '00']
export function pad(n: number, len: number = 2): string {
	const s = n.toString()
	return padValues[len - s.length] + s
}

// Extract the id parameter from a worldstate entry
export function getId(struct: any): string {
	if (!struct._id) {
		return ''
	}
	return struct._id.$oid || struct._id.$id || ''
}

// Extract the date or time parameter from a worldstate entry and return it as unix time
// Return 0 on missing or invalid parameter
export function getDate(struct: any): number {
	if (struct) {
		const timeShort = struct.sec || struct.Time
		if (timeShort && !/\D/.test(timeShort)) {
			// Old worldstate format without milliseconds
			return Number(timeShort)
		}
		if (struct.$date && struct.$date.$numberLong) {
			// New worldstate format with milliseconds
			return Math.floor(Number(struct.$date.$numberLong) / 1000)
		}
	}
	return 0
}

export function getLocation(nodeId: string): string {
	return tags.locations[nodeId] || nodeId
}

export function getMissionType(missionTypeId: string): string {
	return tags.missionTypes[missionTypeId] || missionTypeId
}

export function getNodeMissionType(nodeId: string): string {
	const missionTypeId = tags.nodeMissionTypes[nodeId]
	if (!missionTypeId) {
		return 'Unknown mission type for node ' + nodeId
	}
	return getMissionType(missionTypeId)
}

export function getNodeFaction(nodeId: string): string {
	const factionId = tags.nodeFactions[nodeId]
	if (!factionId) {
		return 'Unknown faction for node ' + nodeId
	}
	return getFaction(factionId)
}

export function getFaction(factionId: string): string {
	return tags.factions[factionId] || factionId
}

export function getVoidTier(voidTierId: string): string {
	return tags.voidTiers[voidTierId] || voidTierId
}

export function getFomorianType(factionId: string): string {
	return tags.fomorianTypes[factionId] || 'Unknown fomorian faction ' + factionId
}

export function getFomorianFaction(projectIdx: string): string {
	return tags.fomorianFactions[projectIdx]
}

export function getSyndicateName(syndicateId: string): string {
	return tags.syndicateNames[syndicateId] || syndicateId
}

export function getVoidTraderName(voidTraderId: string): string {
	return tags.voidTraderNames[voidTraderId] || voidTraderId
}

export function getAcolyteName(acolyteTag: string): string {
	const acolyteId = acolyteTag.substr(acolyteTag.lastIndexOf('/') + 1)
	return tags.acolyteNames[acolyteId] || acolyteId
}
