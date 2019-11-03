const http = require('http')

module.exports = class MockGame {
	constructor(hostname, port) {
		this.hostname = hostname
		this.port = port
		this.server = http.createServer()
	}

	start(callback) {
		this.server.on('request', (req, res) => {
			res.on('finish', () => {
				if (this.onDone) {
					this.onDone()
				}
			})
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

	setDone(onDone) {
		this.onDone = onDone
	}
}
