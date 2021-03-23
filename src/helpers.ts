import * as tags from './tags'

/**
 * Convert number to a string with leading zeros. Helper function for date/time formatting
 */
const padValues = ['', '0', '00']
export function pad(n: number, len = 2): string {
	const s = n.toString()
	return padValues[len - s.length] + s
}

interface IdStruct {
	_id: {
		$id?: string
		$oid?: string
	}
}

/**
 * Extract the id parameter from a worldstate entry
 *
 * @param struct Entry data
 * @returns Entry ID or empty string if not found
 */
export function getId(struct: IdStruct): string {
	return typeof struct === 'object' && struct._id
		? struct._id.$oid || struct._id.$id || ''
		: ''
}

interface DateStruct {
	sec?: string
	Time?: number
	$date?: {
		$numberLong: number
	}
}

/**
 * Extract the date or time parameter from a worldstate entry
 *
 * @param struct Entry data
 * @returns Timestamp in seconds or 0 if missing or invalid parameter
 */
export function getDate(struct: DateStruct): number {
	if (typeof struct === 'object' && struct !== null) {
		const timeShort = struct.sec || struct.Time
		if (timeShort && (typeof timeShort === 'number' || !/\D/.test(timeShort))) {
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

/**
 * Get current unix time
 *
 * @returns Timestamp in seconds
 */
export function getCurrentTime(): number {
	return Math.floor(Date.now() / 1000)
}

/**
 * Convert timestamp to unix time
 *
 * @param str String that will be parsed as a date format
 * @returns Timestamp in seconds or 0 if input cannot be parsed
 */
export function strToTime(str: string): number {
	try {
		return Math.floor(new Date(str).getTime() / 1000)
	}
	catch (err) {
		return 0
	}
}

/**
 * @param nodeId
 * @returns Location of a node in the star chart
 */
export function getLocation(nodeId: string): string {
	return tags.locations[nodeId] || nodeId
}

/**
 * @param missionTypeId
 * @returns Mission type
 */
export function getMissionType(missionTypeId: string): string {
	return tags.missionTypes[missionTypeId] || missionTypeId
}

/**
 * @param nodeId
 * @returns Default mission type associated with a node
 */
export function getNodeMissionType(nodeId: string): string {
	const missionTypeId = tags.nodeMissionTypes[nodeId]
	if (!missionTypeId) {
		return 'Unknown mission type for node ' + nodeId
	}
	return getMissionType(missionTypeId)
}

/**
 * @param nodeId
 * @returns Default faction associated with a node
 */
export function getNodeFaction(nodeId: string): string {
	const factionId = tags.nodeFactions[nodeId]
	if (!factionId) {
		return 'Unknown faction for node ' + nodeId
	}
	return getFaction(factionId)
}

/**
 * @param factionId
 * @returns Faction name
 */
export function getFaction(factionId: string): string {
	return tags.factions[factionId] || factionId
}

/**
 * @param voidTierId
 * @returns Void tier name
 */
export function getVoidTier(voidTierId: string): string {
	return tags.voidTiers[voidTierId] || voidTierId
}

/**
 * @param factionId
 * @returns Name of the faction's fomorian type
 */
export function getFomorianType(factionId: string): string {
	return tags.fomorianTypes[factionId] || 'Unknown fomorian faction ' + factionId
}

/**
 * @param projectIdx
 * @returns Faction ID of a construction project
 */
export function getFomorianFaction(projectIdx: string): string {
	return tags.fomorianFactions[projectIdx] || 'Unknown fomorian project ' + projectIdx
}

/**
 * @param syndicateId
 * @returns Syndicate name
 */
export function getSyndicateName(syndicateId: string): string {
	return tags.syndicateNames[syndicateId] || syndicateId
}

/**
 * @param voidTraderId
 * @returns Void trader name
 */
export function getVoidTraderName(voidTraderId: string): string {
	return tags.voidTraderNames[voidTraderId] || voidTraderId
}

/**
 * @param acolyteTag
 * @returns Acolyte name
 */
export function getAcolyteName(acolyteTag: string): string {
	const acolyteId = acolyteTag.substr(acolyteTag.lastIndexOf('/') + 1)
	return tags.acolyteNames[acolyteId] || acolyteId
}

/**
 * @param challengeTag
 * @returns Challenge info
 */
export function getChallenge(challengeTag: string): WfChallengeInfo {
	const challengeId = challengeTag.substr(challengeTag.lastIndexOf('/') + 1)
	if (challengeId in tags.challenges) {
		return tags.challenges[challengeId]
	}
	return {
		description: 'Unknown challenge ' + challengeId,
		xpAmount: 0,
	}
}

/**
 * Combine bounty job and syndicate info into a reward table ID
 *
 * @param syndicateTag
 * @param tableId
 */
export function getBountyRewardTableId(syndicateTag: string, tableId: string): string {
	return syndicateTag + 'Bounty' + tableId.substr(tableId.lastIndexOf('/') + 1)
}
