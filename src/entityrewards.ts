import items = require('./items')

export default class EntityRewards {
	private cache: WfSet = {}
	private _rewards: WfRewardTableMap = {}

	/**
	 * Add an entity's reward table, if it has one, to a map of reward tables tied to entities in the current worldstate data
	 *
	 * @param entityName
	 */
	add(entityName: string): void {
		entityName = entityName.replace(/ \(.+\)$/, '')
		if (!(entityName in this.cache)) {
			this.cache[entityName] = true
			const entityRewards = items.getRandomRewards(entityName, this)
			if (entityRewards.length) {
				this._rewards[entityName] = entityRewards
			}
		}
	}

	/**
	 * Clear the list of checked entities. Should be called once for each worldstate request
	 */
	clear(): void {
		this._rewards = {}
		this.cache = {}
	}

	get rewards() { return this._rewards }
}
