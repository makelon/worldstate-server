const http = require('http')

module.exports = class MockGame {
	constructor(hostname, port) {
		this.hostname = hostname
		this.port = port
		this.server = http.createServer()
			.on('request', (req, res) => {
				res.on('finish', () => {
					if (this.onDone) {
						this.onDone()
					}
				})
				res.end(this.data, 'utf8')
			})
	}

	start(callback) {
		this.server.listen(this.port, this.hostname, callback)
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
