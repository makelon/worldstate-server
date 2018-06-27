const http = require('http')

const Database = require('../out/db').default
const Server = require('../out/server').default
const Worldstate = require('../out/worldstate').default
const fixtures = require('./deps/fixtures')
const MockGame = require('./deps/mockgame')

describe('Server', () => {
	const ws = new Worldstate(new Database('pc'), 'pc'),
		server = new Server({pc: ws}),
		mockGame = new MockGame('127.0.0.1', 20354)
		timestamp = fixtures.timeNowShort,
		[[testData, expected]] = fixtures.getAlerts()

	afterAll(done => {
		server.shutdown(done)
	})

	it('should request worldstate data', done => {
		ws.flushDb = function() { // Makeshift trigger for read completion
			delete ws.flushDb
			Worldstate.prototype.flushDb.call(ws)
			done()
		}
		mockGame.setData(testData, timestamp)
		mockGame.start(() => {
			server.start()
		})
	}, 1000)

	it('should respond to HTTP requests', done => {
		http.get('http://127.0.0.1:20355/pc/alerts', res => {
			let resData = ''
			res.on('data', s => { resData += s })
			res.on('end', () => {
				try {
					resData = JSON.parse(resData)
				}
				catch (err) {
					done.fail(err)
					return
				}
				expect(resData.time).toEqual(timestamp)
				expect(resData.alerts.time).toBeGreaterThanOrEqual(timestamp)
				expect(resData.alerts.data).toEqual([expected])
				done()
			})
		})
	}, 1000)
})
