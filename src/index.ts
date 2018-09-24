import config from './config'
import items = require('./items')
import log = require('./log')
import tags = require('./tags')
import Server from './server'
import Worldstate from './worldstate'
import Database from './db';

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

process.on('SIGINT', exit)
process.on('SIGTERM', exit)
process.on('SIGUSR2', reload)

load()
const server = new Server({
	pc: new Worldstate(new Database('pc'), 'pc'),
	ps4: new Worldstate(new Database('ps4'), 'ps4'),
	xb1: new Worldstate(new Database('xb1'), 'xb1')
})
server.start()
