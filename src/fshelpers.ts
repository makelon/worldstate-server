import { readFileSync } from 'fs'

import * as log from './log.js'

export function parseJsonFile<T extends Record<string, unknown>>(path: string): T | null {
	let parsedContent: T | null = null
	if (path) {
		try {
			parsedContent = JSON.parse(readFileSync(path, 'utf8'))
		}
		catch (err) {
			if (err.code === 'ENOENT') {
				log.warning('Cannot read JSON data: File \'%s\' does not exist', path)
			}
			else {
				log.error(err.message)
			}
		}
	}
	return parsedContent
}
