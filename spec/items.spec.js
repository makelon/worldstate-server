const items = require('../out/items')

const fixtures = require('./deps/fixtures')

describe('Item functions', () => {
	it('should return items', () => {
		const expectedItems = [
				{
					name: fixtures.items[0].name,
					type: fixtures.items[0].type
				},
				{
					name: fixtures.items[1].name,
					type: fixtures.items[1].type
				},
				{
					name: fixtures.items[2].name,
					type: fixtures.items[2].type
				}
			],
			itemIds = fixtures.items.map(x => x.id)
		expect(items.getItems(itemIds)).toEqual(expectedItems)
	})

	it('should return rewards', () => {
		expect(items.getRewards(fixtures.itemRewards.input)).toEqual(fixtures.itemRewards.output)
	})

	it('should return reward tables', () => {
		expect(items.getRandomRewards(fixtures.rewardTables.input)).toEqual(fixtures.rewardTables.output)
	})

	it('should return bounty reward tables', () => {
		expect(items.getBountyRewards('CetusSyndicate', fixtures.rewardTables.input)).toEqual(fixtures.rewardTables.output)
	})
})
