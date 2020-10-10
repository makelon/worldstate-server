import { readFileSync } from 'fs'

import config from './config'
import * as log from './log'

class ExtraData {
	private data: any = {}

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
	getData<T extends WfRecordKey>(platform: string, dataType: T): any[] {
		return platform in config.wsUrls && platform in this.data && dataType in this.data[platform]
			 ? this.data[platform][dataType]
			 : []
	}
}

const extraData = new ExtraData()
export default extraData
