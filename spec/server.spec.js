import http from 'http'

import config from '../out/config.js'
import Database from '../out/db.js'
import Server from '../out/server.js'
import Worldstate from '../out/worldstate.js'
import fixtures from './fixtures/data.js'
import MockGame from './fixtures/mockgame.js'

describe('Server', () => {
	const ws = new Worldstate(new Database('test')),
		server = new Server(ws),
		mockGame = new MockGame(),
		timestamp = fixtures.timeNowShort,
		[[testData, expected]] = fixtures.getAlerts()

	beforeAll(async () => {
		config.wsUrl = `http://${mockGame.host}:${mockGame.port}`
		const waitForFlush = new Promise(resolve => {
			ws.flushDb = () => resolve()
		})
		mockGame.setData(testData, timestamp)
		mockGame.start(() => {
			server.start()
		})
		await waitForFlush
	}, 1000)

	afterAll(async () => {
		config.wsUrl = ''
		await Promise.all([
			new Promise(resolve => server.shutdown(resolve)),
			new Promise(resolve => mockGame.shutdown(resolve)),
		])
	}, 1000)

	it('should respond to HTTP requests with a specified platform and component type', done => {
		http.get(`http://${config.listen}/pc/alerts`, res => {
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
				expect(res.statusCode).toBe(200)
				expect(resData.time).toEqual(timestamp)
				expect(resData.alerts?.time).toBeGreaterThanOrEqual(timestamp)
				expect(resData.alerts?.data).toEqual([expected])
				expect(maxAgeProxy.length).toEqual(2)
				expect(maxAgeProxy[1]).toBeLessThanOrEqual(updateInterval + 1)
				expect(maxAgeClient.length).toEqual(2)
				expect(maxAgeClient[1]).toBeLessThanOrEqual(updateInterval - 1)
				done()
			})
		})
	}, 1000)

	it('should respond to HTTP requests without a specified platform and with a specified component type', done => {
		http.get(`http://${config.listen}/alerts`, res => {
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
				expect(res.statusCode).toBe(200)
				expect(resData.time).toEqual(timestamp)
				expect(resData.alerts?.time).toBeGreaterThanOrEqual(timestamp)
				expect(resData.alerts?.data).toEqual([expected])
				expect(maxAgeProxy.length).toEqual(2)
				expect(maxAgeProxy[1]).toBeLessThanOrEqual(updateInterval + 1)
				expect(maxAgeClient.length).toEqual(2)
				expect(maxAgeClient[1]).toBeLessThanOrEqual(updateInterval - 1)
				done()
			})
		})
	}, 1000)

	it('should respond to HTTP requests with a specified platform and without a specified component type', done => {
		http.get(`http://${config.listen}/pc`, res => {
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
				expect(res.statusCode).toBe(200)
				expect(resData.time).toEqual(timestamp)
				expect(resData.alerts?.time).toBeGreaterThanOrEqual(timestamp)
				expect(resData.alerts?.data).toEqual([expected])
				expect(maxAgeProxy.length).toEqual(2)
				expect(maxAgeProxy[1]).toBeLessThanOrEqual(updateInterval + 1)
				expect(maxAgeClient.length).toEqual(2)
				expect(maxAgeClient[1]).toBeLessThanOrEqual(updateInterval - 1)
				done()
			})
		})
	}, 1000)

	it('should respond to HTTP requests without a specified platform and without a specified component type', done => {
		http.get(`http://${config.listen}/`, res => {
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
				expect(res.statusCode).toBe(200)
				expect(resData.time).toEqual(timestamp)
				expect(resData.alerts?.time).toBeGreaterThanOrEqual(timestamp)
				expect(resData.alerts?.data).toEqual([expected])
				expect(maxAgeProxy.length).toEqual(2)
				expect(maxAgeProxy[1]).toBeLessThanOrEqual(updateInterval + 1)
				expect(maxAgeClient.length).toEqual(2)
				expect(maxAgeClient[1]).toBeLessThanOrEqual(updateInterval - 1)
				done()
			})
		})
	}, 1000)
})
