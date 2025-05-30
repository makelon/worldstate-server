import { chmodSync } from 'fs'
import { createServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http'
import { isIP, isIPv6 } from 'net'
import { platform } from 'os'

import config from './config.js'
import * as log from './log.js'
import type Worldstate from './worldstate.js'

export default class Server {
	private httpServer: HttpServer
	private running = false

	/**
	 * Create a server and set up its HTTP event listeners
	 *
	 * @param ws Worldstate instance to keep track of and update
	 */
	constructor(private readonly ws: Worldstate) {
		this.httpServer = createServer()
			.on('request', (req, res) => { this.handleRequest(req, res) })
			.on('error', (err: NodeJS.ErrnoException) => {
				if (this.httpServer.listening) {
					log.error(err.message)
				}
				else {
					log.error('Server error: Failed to set up listener (%s)', err.message)
					process.exit(1)
				}
			})
	}

	/**
	 * Start the server and initialize the Worldstate instance
	 */
	start(): void {
		if (this.running) {
			log.info('Server is already running')
			return
		}
		this.running = true
		this.startServer()
		this.ws.start()
	}

	/**
	 * Reload the server and Worldstate instance and restart the listener as required by config changes
	 */
	reload(): void {
		const oldListen = config.listen
		this.ws.reload()
		if (config.listen !== oldListen) {
			this.startServer()
		}
	}

	/**
	 * Shut down the server and call the given callback when done
	 *
	 * @param callback Function to call after shutdown
	 */
	shutdown(callback: () => void): void {
		log.info('Cleaning up before exit')
		if (this.httpServer.listening) {
			this.httpServer.close(callback)
		}
		else {
			callback()
		}
	}

	/**
	 * (Re-)start the HTTP server if enabled in configuration
	 */
	private startServer() {
		if (this.httpServer.listening) {
			log.info('Restarting server')
			this.httpServer.close(() => { this.startServer() })
			return
		}
		if (!config.listen) {
			log.info('Server with PID %d running', process.pid)
			return
		}
		if (typeof config.listen !== 'number' && typeof config.listen !== 'string') {
			log.error('Config error: Expected a number or a string for the listen setting')
			process.exit(1)
		}
		const listenOpts: {
			port?: number
			host?: string
			path?: string
		} = {}
		if (typeof config.listen === 'number' || /^\d+$/.test(config.listen)) {
			listenOpts.port = Number(config.listen)
		}
		else if (typeof config.listen === 'string') {
			const addrLen = config.listen.search(/:\d+$/)
			if (addrLen === -1) {
				listenOpts.path = config.listen
			}
			else {
				const address = config.listen.substring(0, addrLen),
					port = Number(config.listen.substring(addrLen + 1))
				let address6: string | undefined
				if (address[0] === '[' && address[address.length - 1] === ']' ) {
					address6 = address.slice(1, -1)
				}
				if (address6 && isIPv6(address6)) {
					listenOpts.host = address6
					listenOpts.port = port
				}
				else if (isIP(address)) {
					listenOpts.host = address
					listenOpts.port = port
				}
				else if (addrLen === 0 || address === '*') {
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
		try {
			this.httpServer.listen(listenOpts, () => {
				const address = this.httpServer.address()
				let listenStr
				if (address === null) {
					log.error('Server does not seem to be listening')
					process.exit(1)
				}
				else if (typeof address === 'string') {
					if (platform() !== 'win32') {
						chmodSync(address, 0o660)
					}
					listenStr = address
				}
				else if (address.family === 'IPv6' || (typeof address.family === 'number' && address.family === 6)) {
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

	private handleRequest(req: IncomingMessage, res: ServerResponse) {
		let responseText = ''
		req.on('error', err => { log.info('HTTP request error: %s', err.message) })
		res.once('finish', () => {
			log.notice('Responded with %s %s (%d bytes)', res.statusCode, res.statusMessage, Buffer.byteLength(responseText))
		})
		if (config.cors) {
			res.setHeader('Access-Control-Allow-Origin', config.cors)
		}
		switch (req.method) {
			case 'GET':
				responseText = this.handleGetRequest(req, res)
				break
			case 'OPTIONS':
				this.handleOptionsRequest(req, res)
				break
			default:
				res.statusCode = 405
		}
		res.end(responseText)
	}

	/**
	 * Read and respond to a GET request
	 *
	 * @param req
	 * @param res
	 */
	private handleGetRequest(req: IncomingMessage, res: ServerResponse): string {
		const reqUrl = req.url || '/'
		log.notice('Received GET request: %s', reqUrl)
		const urlParts = reqUrl.substring(1).split('/')

		let types
		if (['pc', 'ps4', 'xb1', 'ns'].includes(urlParts[0])) {
			types = urlParts[1]?.split(',')
		}
		else if (urlParts[0] !== '') {
			types = urlParts[0].split(',')
		}

		const responseText = this.ws.get(types)
		// Set s-maxage to tell caches when the next update happens
		const cacheTtl = Math.ceil((this.ws.getNextUpdate() - Date.now()) / 1000)
		// Set max-age to tell browsers to update every <updateInterval> seconds. Subtract 1 to prevent accidental cache hits
		const cacheTtlBrowser = config.updateInterval < 1000 ? 0 : Math.floor(config.updateInterval / 1000) - 1
		res.setHeader('Last-Modified', new Date().toUTCString())
		res.setHeader('Cache-Control', `max-age=${cacheTtlBrowser},s-maxage=${cacheTtl}`)
		res.setHeader('Content-Type', 'application/json; charset=utf-8')
		return responseText
	}

	/**
	 * Read and respond to an OPTIONS request
	 *
	 * @param req
	 * @param res
	 */
	private handleOptionsRequest(req: IncomingMessage, res: ServerResponse) {
		const reqUrl = req.url || '/'
		log.notice('Received OPTIONS request: %s', reqUrl)
		res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
		res.setHeader('Access-Control-Max-Age', 3600)
		res.setHeader('Vary', 'Accept-Encoding, Origin')
		res.statusCode = 204
	}
}
