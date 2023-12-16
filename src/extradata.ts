import config from './config.js'
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
	private data: WfMap<WfPlatform, ExtraPlatformData> = {}

	/**
	 * Load extra data that isn't available in the worldstate dump
	 *
	 * @param dataPath
	 */
	load(dataPath: string): void {
		this.data = parseJsonFile(dataPath) || {}
	}

	/**
	 * @param platform
	 * @param dataType
	 * @returns Extra data of the selected type for the chosen platform
	 */
	getData<T extends keyof ExtraPlatformData>(platform: WfPlatform, dataType: T): ExtraPlatformData[T] {
		return platform in config.wsUrls
			? this.data[platform]?.[dataType] || []
			: []
	}
}

const extraData = new ExtraData()
export default extraData
