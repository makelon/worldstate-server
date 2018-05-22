import fs = require('fs')
import http = require('http')
import net = require('net')
import os = require('os')
import path = require('path')
import log = require('./log')
import Worldstate from './worldstate'
import tags = require('./tags')
import items = require('./items')
import config from './config'

process.chdir(path.dirname(process.argv[1]))

function load(): void {
	try {
		config.load()
		log.setLevel(config.logLevel)
		log.setTimestamps(config.enableConsoleTime)
		tags.load()
		items.load()
	}
	catch (err) {
		log.error(err.message)
		process.exit(1)
	}
	log.info('Loaded config and info tables')
}

function reload(): void {
	const oldListen = config.listen
	load()
	for (const platform in instances) {
		instances[platform].reload()
	}
	if (config.listen != oldListen) {
		startServer()
	}
}

function shutdown() {
	log.info('Cleaning up before exit')
	if (server && server.listening) {
		server.close(process.exit)
	}
	else {
		process.exit()
	}
}

function startServer() {
	if (server && server.listening) {
		log.info('Restarting server')
		server.close(startServer)
		return
	}
	if (!config.listen) {
		log.info('Server with PID %d running', process.pid)
		return
	}
	if (typeof config.listen != 'number' && typeof config.listen != 'string') {
		log.error('Config error: Expected a number or a string for the listen setting')
		process.exit(1)
	}
	const listenOpts: {
		port?: number
		host?: string
		path?: string
	} = {}
	if (typeof config.listen == 'number' || /^\d+$/.test(config.listen)) {
		listenOpts.port = Number(config.listen)
	}
	else if (typeof config.listen == 'string') {
		const addrLen = config.listen.search(/:\d+$/)
		if (addrLen == -1) {
			listenOpts.path = config.listen
		}
		else {
			let address = config.listen.substr(0, addrLen),
				address6,
				port = Number(config.listen.substr(addrLen + 1))
			if (address[0] == '[' && address[address.length - 1] == ']' ) {
				address6 = address.slice(1, -1)
			}
			if (address6 && net.isIPv6(address6)) {
				listenOpts.host = address6
				listenOpts.port = port
			}
			else if (net.isIP(address)) {
				listenOpts.host = address
				listenOpts.port = port
			}
			else if (addrLen == 0 || address == '*') {
				listenOpts.port = port
			}
			else {
				listenOpts.path = config.listen
			}
		}
	}
	if (!(listenOpts.port || listenOpts.path)) {
		log.error('Config error: "%s" is not a valid value for the listen setting', config.listen)
		process.exit(1)
	}
	if (!server) {
		server = http.createServer()
			.on('request', handleRequest)
			.on('error', err => {
				if (server.listening) {
					log.error(err.message)
				}
				else {
					log.error('Server error: Failed to set up listener (%s)', err.message)
					process.exit(1)
				}
			})
	}
	try {
		server.listen(listenOpts, () => {
			const address = server.address()
			let listenStr
			if (typeof address == 'string') {
				if (os.platform() != 'win32') {
					fs.chmodSync(address, 0o660)
				}
				listenStr = address
			}
			else if (address.family == 'IPv6') {
				listenStr = `[${address.address}]:${address.port}`
			}
			else {
				listenStr = `${address.address}:${address.port}`
			}
			log.info('Server with PID %d listening on %s', process.pid, listenStr)
		})
	}
	catch (err) {
		log.error('Server error: %s', err.message)
		process.exit(1)
	}
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
	const reqUrl = req.url || '/'
	log.notice('Got request: %s', reqUrl)
	req.on('error', err => { log.info('HTTP request error: %s', err.message) })
	if (reqUrl == '/reload') {
		// Permitting HTTP reload requests can be useful for testing and Windows platforms
		if (!config.enableHttpReload) {
			res.statusCode = 404
			res.end()
		}
		else {
			res.end()
			reload()
		}
		return
	}
	const urlParts = reqUrl.substr(1).split('/'),
		platform = urlParts[0] || 'pc',
		instance = instances[platform]
	let responseText: string,
		cacheTtl: number,
		cacheTtlBrowser: number
	if (instance) {
		let types
		if (urlParts[1]) {
			types = urlParts[1].split(',')
		}
		responseText = instance.get(types)
		// Set s-maxage to tell caches when the next update happens
		cacheTtl = Math.ceil(instance.getNextUpdate() / 1000)
		// Set max-age to tell browsers to update every <updateInterval> seconds. Subtract 1 to prevent accidental cache hits
		cacheTtlBrowser = config.updateInterval < 1000 ? 0 : Math.floor(config.updateInterval / 1000) - 1
	}
	else {
		res.statusCode = 404
		responseText = JSON.stringify(`Unknown platform ${platform}`)
		cacheTtl = cacheTtlBrowser = 86400
	}
	res.setHeader('Cache-Control', `max-age=${cacheTtlBrowser},s-maxage=${cacheTtl}`)
	res.setHeader('Content-Type', 'application/json')
	if (config.cors) {
		res.setHeader('Access-Control-Allow-Origin', config.cors)
	}
	res.once('finish', () => {
		log.notice('Responded with %s %s (%d bytes)', res.statusCode, res.statusMessage, Buffer.byteLength(responseText))
	}).end(responseText, 'utf8')
}

let server: http.Server
const instances: { [name: string]: Worldstate } = {}

load()
startServer()
instances.pc = new Worldstate('pc')
instances.xb1 = new Worldstate('xb1')
instances.ps4 = new Worldstate('ps4')

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('SIGUSR2', reload)
