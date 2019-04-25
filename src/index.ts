import config from './config'
import extraData from './extradata'
import items = require('./items')
import log = require('./log')
import tags = require('./tags')
import Server from './server'
import Worldstate from './worldstate'
import Database from './db'

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
		items.load('./rewardtables.json', './rewardtables-rotations.json', './itemnames.json', './itemtypes.json')
		tags.load('./starchart.json', './challenges.json')
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
for (const platform in config.wsUrls) {
	wsInstances[platform] = new Worldstate(new Database(platform), platform)
}
const server = new Server(wsInstances)
server.start()
