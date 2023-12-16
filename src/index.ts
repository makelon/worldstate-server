import { dirname } from 'path'
import { fileURLToPath } from 'url'

import config from './config.js'
import Database from './db.js'
import extraData from './extradata.js'
import { load as loadItems } from './items.js'
import * as log from './log.js'
import Server from './server.js'
import { load as loadTags } from './tags.js'
import Worldstate from './worldstate.js'

process.chdir(dirname(fileURLToPath(import.meta.url)))

/**
 * Shut down server and exit
 */
function exit() {
	server.shutdown(process.exit)
}

/**
 * Load config and info tables
 */
function load() {
	config.load('./config.json')
	log.setLevel(config.logLevel)
	log.setTimestamps(config.enableConsoleTime)
	try {
		loadItems('./rewardtables.json', './rewardtables-rotations.json', './itemnames.json', './itemtypes.json')
		loadTags('./starchart.json', './challenges.json', './translations.json')
		extraData.load('./extradata.json')
	}
	catch (err) {
		log.error(err.message)
		process.exit(1)
	}
	log.info('Loaded config and info tables')
}

/**
 * Reload config and info tables, then propagate the reload instruction to submodules
 */
function reload() {
	load()
	server.reload()
}

process.on('SIGINT', exit)
process.on('SIGTERM', exit)
process.on('SIGUSR2', reload)

load()
const wsInstances: {[platform: string]: Worldstate} = {}
let numInstances = 0
for (const platform in config.wsUrls) {
	wsInstances[platform] = new Worldstate(new Database(platform), platform as WfPlatform, config.instanceDelay * numInstances)
	++numInstances
}
const server = new Server(wsInstances)
server.start()
