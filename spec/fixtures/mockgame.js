import { EventEmitter } from 'events'
import { createServer } from 'http'

let port = 20356

export default class MockGame {
	constructor() {
		this._host = '127.0.0.1'
		this._port = port++
		this.ee = new EventEmitter()
		this.server = createServer()
	}

	start(callback) {
		this.server.on('request', (req, res) => {
			this.ee.emit('request', req)
			res.end(this.data, 'utf8')
		})
		this.server.listen(this.port, this._host, callback)
	}

	shutdown(callback) {
		this.server.close(callback)
	}

	setData(data, timestamp) {
		data.WorldSeed = 'mock'
		data.Time = timestamp
		this.data = JSON.stringify(data)
	}

	getRequestHeaders() {
		return new Promise((resolve) => {
			this.ee.once('request', (req) => {
				resolve(req.headers)
			})
		})
	}

	get host() {
		return this._host
	}

	get port() {
		return this._port
	}
}
