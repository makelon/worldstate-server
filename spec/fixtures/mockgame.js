import { createServer } from 'http'

let port = 20356

export default class MockGame {
	constructor() {
		this._host = '127.0.0.1'
		this._port = port++
		this.server = createServer()
	}

	start(callback) {
		this.server.on('request', (req, res) => {
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

	get host() {
		return this._host
	}

	get port() {
		return this._port
	}
}
