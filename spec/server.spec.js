import http from 'http'

import config from '../out/config.js'
import Database from '../out/db.js'
import Server from '../out/server.js'
import Worldstate from '../out/worldstate.js'
import fixtures from './fixtures/data.js'
import MockGame from './fixtures/mockgame.js'

describe('Server', () => {
	const mockGameHost = '127.0.0.1',
		mockGamePort = 20354,
		ws = new Worldstate(new Database('pc'), 'pc', 0),
		server = new Server({pc: ws}),
		mockGame = new MockGame(mockGameHost, mockGamePort),
		timestamp = fixtures.timeNowShort,
		[[testData, expected]] = fixtures.getAlerts()

	beforeAll(() => {
		config.wsUrls.pc = `http://${mockGameHost}:${mockGamePort}`
	})

	afterAll(done => {
		config.wsUrls = {}
		Promise.all([
			new Promise(resolve => server.shutdown(resolve)),
			new Promise(resolve => mockGame.shutdown(resolve)),
		]).then(() => done())
	}, 1000)

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
				const cacheControl = res.headers['cache-control'],
					maxAgeProxy = cacheControl.match(/s-maxage\s*=\s*(\d+)/),
					maxAgeClient = cacheControl.match(/max-age\s*=\s*(\d+)/),
					updateInterval = config.updateInterval / 1000
				expect(resData.time).toEqual(timestamp)
				expect(resData.alerts.time).toBeGreaterThanOrEqual(timestamp)
				expect(resData.alerts.data).toEqual([expected])
				expect(maxAgeProxy.length).toEqual(2)
				expect(maxAgeProxy[1]).toBeLessThanOrEqual(updateInterval + 1)
				expect(maxAgeClient.length).toEqual(2)
				expect(maxAgeClient[1]).toBeLessThanOrEqual(updateInterval - 1)
				done()
			})
		})
	}, 1000)
})
