const items = require('../out/items')

const fixtures = require('./deps/fixtures')
const EntityRewards = require('../out/entityrewards').default

describe('Item functions', () => {
	it('should return items', () => {
		const entityRewards = new EntityRewards(),
			expectedItems = [
				{ name: fixtures.items[0].name, type: fixtures.items[0].type },
				{ name: fixtures.items[1].name, type: fixtures.items[1].type },
				{ name: fixtures.items[2].name, type: fixtures.items[2].type }
			],
			itemIds = fixtures.items.map(x => x.id)
		expect(items.getItems(itemIds, entityRewards)).toEqual(expectedItems)
		expect(entityRewards.rewards).toEqual(fixtures.entityRewardTables)
	})

	it('should return entity rewards', () => {
		const entityRewards = new EntityRewards()
		entityRewards.add(`${fixtures.items[0].name} (Test)`)
		expect(entityRewards.rewards).toEqual(fixtures.entityRewardTables)
	})

	it('should return rewards', () => {
		const entityRewards = new EntityRewards(),
			rewards = items.getRewards(fixtures.itemRewards.input, entityRewards)
		expect(rewards).toEqual(fixtures.itemRewards.output)
		expect(entityRewards.rewards).toEqual(fixtures.entityRewardTables)
	})

	it('should return reward tables', () => {
		const entityRewards = new EntityRewards(),
			rewards = items.getRandomRewards(fixtures.rewardTables[0].input, entityRewards)
		expect(rewards).toEqual(fixtures.rewardTables[0].output)
		expect(entityRewards.rewards).toEqual(fixtures.entityRewardTables)
	})

	it('should return bounty reward tables', () => {
		const entityRewards = new EntityRewards(),
			rewards = items.getBountyRewards('CetusSyndicate', fixtures.rewardTables[1].input, entityRewards)
		expect(rewards).toEqual(fixtures.rewardTables[1].output)
		expect(entityRewards.rewards).toEqual(fixtures.entityRewardTables)
	})
})
