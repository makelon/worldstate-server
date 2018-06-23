import config from './config'
import items = require('./items')
import log = require('./log')
import tags = require('./tags')
import Server from './server'
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
		items.load('./rewardtables.json', './itemnames.json', './itemtypes.json')
		tags.load('./starchart.json')
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

/**
 * Start the server
 */
function start() {
	load()
	server.start()
}

const server = new Server({
	pc: new Worldstate('pc'),
	ps4: new Worldstate('ps4'),
	xb1: new Worldstate('xb1')
})

process.on('SIGINT', exit)
process.on('SIGTERM', exit)
process.on('SIGUSR2', reload)

start()
