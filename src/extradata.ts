import { parseJsonFile } from './fshelpers.js'

interface ExtraPlatformDataBountyJob {
	rewards: string,
	minEnemyLevel: number,
	maxEnemyLevel: number,
	xpAmounts: number[],
	title: string,
}

interface ExtraPlatformDataBounty {
	id: string,
	syndicate: string,
	jobs: ExtraPlatformDataBountyJob[],
}

interface ExtraPlatformData {
	bounties: ExtraPlatformDataBounty[],
}

class ExtraData {
	private data: ExtraPlatformData = { bounties: [] }

	/**
	 * Load extra data that isn't available in the worldstate dump
	 *
	 * @param dataPath
	 */
	load(dataPath: string): void {
		const data = parseJsonFile<ExtraPlatformData>(dataPath)
		this.data.bounties = data && ('bounties' in data) ? data.bounties : []
	}

	/**
	 * @param dataType
	 * @returns Extra data of the selected type
	 */
	getData<T extends keyof ExtraPlatformData>(dataType: T): ExtraPlatformData[T] {
		return this.data[dataType] || []
	}
}

const extraData = new ExtraData()
export default extraData
