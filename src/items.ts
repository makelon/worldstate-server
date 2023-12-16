import { readFileSync } from 'fs'

import type EntityRewards from './entityrewards.js'

let rewardTables: WfRewardTableMap,
	rewardTableRotations: WfMap,
	itemNames: WfMap,
	itemTypes: WfMap,
	lcItemIds: boolean

/**
 * Load item info and reward tables
 *
 * @param _rewardTables Path to reward table JSON data
 * @param _rewardTableRotations Path to reward table rotation JSON data
 * @param _itemNames Path to item name JSON data
 * @param _itemTypes Path to item type JSON data
 */
export function load(_rewardTables: string, _rewardTableRotations: string, _itemNames: string, _itemTypes: string): void {
	try {
		rewardTables = JSON.parse(readFileSync(_rewardTables, 'utf8'))
		rewardTableRotations = JSON.parse(readFileSync(_rewardTableRotations, 'utf8'))
		itemNames = JSON.parse(readFileSync(_itemNames, 'utf8'))
		itemTypes = JSON.parse(readFileSync(_itemTypes, 'utf8'))
	}
	catch (err) {
		throw new Error(`Failed to load item info: '${err.message}'`)
	}
	lcItemIds = 'powersuits/mag/mag' in itemNames
}

/**
 * @param itemName
 * @returns Item type of a given item or 'Misc' if unknown
 */
function getItemType(itemName: string): string {
	if (itemName.slice(-4) === 'Endo') {
		return 'Endo'
	}
	return itemTypes[itemName] || 'Misc'
}

/**
 * @param itemId
 * @param entityRewards An EntityRewards object to store the item's reward table in
 * @returns Name and type of the item matching a given item ID
 */
export function getItem(itemId: string, entityRewards: EntityRewards): WfItem {
	// Id prefixes are stripped to reduce memory consumption of the <itemNames> map
	itemId = itemId.replace(/^\/Lotus(?:(?:\/Types)?\/StoreItems)?\//, '')
	const itemName = itemNames[lcItemIds ? itemId.toLowerCase() : itemId] || itemId.substr(itemId.lastIndexOf('/') + 1)
	entityRewards.add(itemName)
	return {
		name: itemName,
		type: getItemType(itemName),
	}
}

/**
 * @param itemIds
 * @param entityRewards An EntityRewards object to store each item's reward table in
 * @returns Names and types of the items matching given item IDs
 */
export function getItems(itemIds: string[], entityRewards: EntityRewards): WfItem[] {
	const ret: WfItem[] = []
	for (const itemId of itemIds) {
		ret.push(getItem(itemId, entityRewards))
	}
	return ret
}

interface RewardsStruct {
	credits?: number
	items?: string[]
	countedItems?: Array<{
		ItemType: string
		ItemCount: string
	}>
}

/**
 * Create a WfRewards object with credit and item rewards for the given input.
 * Refer to types.ts for details.
 *
 * @param rewards
 * @param entityRewards An EntityRewards object to store each reward's reward table in
 * @returns Reward info
 */
export function getRewards(rewards: RewardsStruct, entityRewards: EntityRewards): WfRewards | null {
	const ret: WfRewards = {},
		items: WfReward[] = []
	if (rewards.credits) {
		ret.credits = Number(rewards.credits)
	}
	for (const itemId of rewards.items || []) {
		const item = getItem(itemId, entityRewards)
		items.push({
			name: item.name,
			type: item.type,
			count: 1,
		})
	}
	for (const reward of rewards.countedItems || []) {
		const item = getItem(reward.ItemType, entityRewards)
		items.push({
			name: item.name,
			type: item.type,
			count: Number(reward.ItemCount),
		})
	}
	if (items.length > 0) {
		ret.items = items
	}
	return ret.items || ret.credits ? ret : null
}

/**
 * Return reward table as an array of reward tiers, where each reward tier is an array of rewards.
 * Refer to types.d.ts for details.
 *
 * @param tableId Reward table manifest ID
 * @param entityRewards An EntityRewards object to store each reward's reward table in
 */
export function getRandomRewards(tableId: string, entityRewards: EntityRewards): WfRandomRewardTable {
	const ret: WfRandomRewardTable = []
	tableId = tableId.substr(tableId.lastIndexOf('/') + 1)
	if (!(tableId in rewardTables)) {
		return ret
	}
	const rewardTable = rewardTables[tableId]
	for (const tier of rewardTable) {
		const retTier: WfRandomReward[] = []
		ret.push(retTier)
		for (const reward of tier) {
			retTier.push({
				name: reward.name,
				type: getItemType(reward.name),
				count: reward.count,
				chance: reward.chance,
			})
			entityRewards.add(reward.name)
		}
	}
	return ret
}

/**
 * @param tableId
 * @returns Rotation identifier of a given reward table
 */
export function getRewardTableRotation(tableId: string): string {
	return rewardTableRotations[tableId] || ''
}
