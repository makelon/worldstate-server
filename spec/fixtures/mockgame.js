import { createServer } from 'http'

export default class MockGame {
	constructor(hostname, port) {
		this.hostname = hostname
		this.port = port
		this.server = createServer()
	}

	start(callback) {
		this.server.on('request', (req, res) => {
			res.end(this.data, 'utf8')
		})
		this.server.listen(this.port, this.hostname, callback)
	}

	shutdown(callback) {
		this.server.close(callback)
	}

	setData(data, timestamp) {
		data.WorldSeed = 'mock'
		data.Time = timestamp
		this.data = JSON.stringify(data)
	}
}
