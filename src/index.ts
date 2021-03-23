import config from './config'
import Database from './db'
import extraData from './extradata'
import { load as loadItems } from './items'
import * as log from './log'
import Server from './server'
import { load as loadTags } from './tags'
import Worldstate from './worldstate'

process.chdir(__dirname)

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
		loadTags('./starchart.json', './challenges.json')
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
