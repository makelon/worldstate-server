import fs = require('fs')
import tags = require('./tags')
import config from './config'

let rewardTables: WfRewardTableMap,
	itemNames: WfMap,
	itemTypes: WfMap,
	lcItemIds: boolean

export function load(): void {
	try {
		rewardTables = JSON.parse(fs.readFileSync('./rewardtables.json', 'utf8'))
		itemNames = JSON.parse(fs.readFileSync('./itemnames.json', 'utf8'))
		itemTypes = JSON.parse(fs.readFileSync('./itemtypes.json', 'utf8'))
	}
	catch (err) {
		throw new Error(`Failed to load item info: '${err.message}'`)
	}
	lcItemIds = 'powersuits/mag/mag' in itemNames
}

function getItemType(itemName: string): string {
	if (itemName.slice(-4) == 'Endo') {
	  return 'Endo'
	}
	return itemTypes[itemName] || 'Misc'
}

// Return name and type of the item matching the given item id
export function getItem(itemId: string): WfItem {
	// Id prefixes are stripped to reduce memory consumption of the <itemNames> map
	itemId = itemId.replace(/^\/Lotus(?:(?:\/Types)?\/StoreItems)?\//, '')
	const itemName = itemNames[lcItemIds ? itemId.toLowerCase() : itemId] || itemId.substr(itemId.lastIndexOf('/') + 1)
	return {
		name: itemName,
		type: getItemType(itemName)
	}
}

export function getItems(itemIds: string[]): WfItem[] {
	const ret: WfItem[] = []
	for (const itemId of itemIds) {
		ret.push(getItem(itemId))
	}
	return ret
}

export function getRewards(rewards: any): WfRewards | null {
	const ret: WfRewards = {},
		items: WfReward[] = []
	if (rewards.credits) {
		ret.credits = Number(rewards.credits)
	}
	for (const itemId of rewards.items || []) {
		const item = getItem(itemId)
		items.push({
			name: item.name,
			type: item.type,
			count: 1
		})
	}
	for (const reward of rewards.countedItems || []) {
		const item = getItem(reward.ItemType)
		items.push({
			name: item.name,
			type: item.type,
			count: Number(reward.ItemCount)
		})
	}
	if (items.length > 0) {
		ret.items = items
	}
	return ret.items || ret.credits ? ret : null
}

// Return reward table as an array of reward tiers, where each reward tier is an array of rewards.
// Refer to types.ts for details
export function getRandomRewards(tableId: string): WfRandomRewardTable {
	tableId = tableId.substr(tableId.lastIndexOf('/') + 1)
	const rewardTable = rewardTables[tableId] || [],
		ret: WfRandomRewardTable = []
	for (const tier of rewardTable) {
		const retTier: WfRandomReward[] = []
		ret.push(retTier)
		for (const reward of tier) {
			retTier.push({
				name: reward.name,
				type: getItemType(reward.name),
				count: reward.count,
				chance: reward.chance
			})
		}
	}
	return ret
}

// Bounty reward table ids are prefixed with the syndicate tag
export function getBountyRewards(syndicateTag: string, tableId: string): WfRandomRewardTable {
	tableId = syndicateTag + 'Bounty' + tableId.substr(tableId.lastIndexOf('/') + 1)
	return getRandomRewards(tableId)
}
