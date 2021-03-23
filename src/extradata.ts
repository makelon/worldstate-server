import { readFileSync } from 'fs'

import config from './config'
import * as log from './log'

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
		try {
			this.data = JSON.parse(readFileSync(dataPath, 'utf8'))
		}
		catch (err) {
			if (err.code !== 'ENOENT') {
				log.error(`Failed to load data: '${err.message}'`)
			}
			this.data = {}
		}
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
