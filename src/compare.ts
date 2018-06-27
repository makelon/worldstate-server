export function patch<T extends WfRecordType>(obj: T, diff: Partial<T>): void {
	for (const key in diff) {
		if (diff[key] === undefined) {
			delete obj[key]
		}
		else {
			obj[key] = (diff as T)[key]
		}
	}
}

export function getValueDifference<T extends WfRecordType>(first: T, second: T, keys: (keyof T)[]): Partial<T> {
	const diff: Partial<T> = {}
	for (const key of keys) {
		if (first[key] != second[key]) {
			diff[key] = second[key]
		}
	}
	return diff
}

export function getItemDifference(first?: WfItem[], second?: WfItem[]): WfItem[] | undefined | null {
	if (!first || !second) {
		if (first) {
			// <second> is empty
			return undefined
		}
		else if (!second) {
			// Both are empty
			return null
		}
		else {
			// <first> is empty
			return second
		}
	}

	if (first.length != second.length) {
		return second
	}
	for (let itemIdx = 0; itemIdx < first.length; ++itemIdx) {
		const itemFirst = first[itemIdx],
			itemSecond = second[itemIdx]
		if (
			itemFirst.name != itemSecond.name
			|| itemFirst.type != itemSecond.type
		) {
			return second
		}
	}
	return null
}

export function getRewardDifference(first?: WfRewards, second?: WfRewards): WfRewards | undefined | null {
	if (!first || !second) {
		if (first) {
			// <second> is empty
			return undefined
		}
		else if (!second) {
			// Both are empty
			return null
		}
		else {
			// <first> is empty
			return second
		}
	}

	if (first.credits != second.credits) {
		return second
	}
	if (first.items) {
		if (second.items && first.items.length == second.items.length) {
			for (let itemIdx = 0; itemIdx < first.items.length; ++itemIdx) {
				const itemFirst = first.items[itemIdx],
					itemSecond = second.items[itemIdx]
				if (
					itemFirst.name != itemSecond.name
					|| itemFirst.type != itemSecond.type
					|| itemFirst.count != itemSecond.count
				) {
					return second
				}
			}
		}
		else {
			return second
		}
	}
	else if (second.items) {
		return second
	}
	return null
}

export function getRandomRewardDifference(first?: WfRandomRewardTable, second?: WfRandomRewardTable): WfRandomRewardTable | undefined | null {
	if (!first || !second) {
		if (first) {
			// <second> is empty
			return undefined
		}
		else if (!second) {
			// Both are empty
			return null
		}
		else {
			// <first> is empty
			return second
		}
	}

	for (let tierIdx = 0; tierIdx < first.length; ++tierIdx) {
		const tierFirst = first[tierIdx],
			tierSecond = second[tierIdx]
		if (tierFirst.length != tierSecond.length) {
			return second
		}
		for (let itemIdx = 0; itemIdx < tierFirst.length; ++itemIdx) {
			const itemFirst = tierFirst[itemIdx],
				itemSecond = tierSecond[itemIdx]
			if (
				itemFirst.name != itemSecond.name
				|| itemFirst.type != itemSecond.type
				|| itemFirst.count != itemSecond.count
				|| itemFirst.chance != itemSecond.chance
			) {
				return second
			}
		}
	}
	return null
}

export function getVoidTraderItemDifference(first?: WfVoidTraderItem[], second?: WfVoidTraderItem[]): WfVoidTraderItem[] | undefined | null {
	if (!first || !second) {
		if (first) {
			// <second> is empty
			return undefined
		}
		else if (!second) {
			// Both are empty
			return null
		}
		else {
			// <first> is empty
			return second
		}
	}

	if (first.length != second.length) {
		return second
	}
	for (let itemIdx = 0; itemIdx < first.length; ++itemIdx) {
		const itemFirst = first[itemIdx],
			itemSecond = second[itemIdx]
		if (
			itemFirst.name != itemSecond.name
			|| itemFirst.type != itemSecond.type
			|| itemFirst.credits != itemSecond.credits
			|| itemFirst.ducats != itemSecond.ducats
		) {
			return second
		}
	}
	return null
}
