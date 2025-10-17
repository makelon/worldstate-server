import config from '../out/config.js'
import Database from '../out/db.js'
import extraData from '../out/extradata.js'
import Worldstate from '../out/worldstate.js'
import fixtures from './fixtures/data.js'
import MockGame from './fixtures/mockgame.js'

describe('Worldstate readers', () => {
	const db = new Database('test')
	const ws = new Worldstate(db)

	function runStandardTests(dataKey, testCaseGenerator, worldstateReader, includeExpireTest) {
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of testCaseGenerator()) {
			setWorldstateData(data, timestamp)
			worldstateReader.call(ws)
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data).toEqual(Array.isArray(expected) ? expected : [expected])
			timestamp += fixtures.timeStep
		}
		if (includeExpireTest) {
			runExpireTest(dataKey, testCaseGenerator, worldstateReader)
		}
	}

	function runExpireTest(dataKey, testCaseGenerator, worldstateReader) {
		setWorldstateData(testCaseGenerator().next().value[0], fixtures.timeNowShort)
		worldstateReader.call(ws)
		let result = JSON.parse(ws.get([dataKey]))
		expect(result[dataKey].data.length).toBe(1)
		ws.now = fixtures.timeEndShort + 1
		result = JSON.parse(ws.get([dataKey]))
		expect(result[dataKey].data.length).toBe(0)
	}

	function setWorldstateData(data, timestamp) {
		ws.ws = data
		ws.now = timestamp
	}

	beforeAll(done => {
		db.ee.once('load', done)
		ws.start()
	})

	it('should read acolytes', () => {
		runStandardTests('acolytes', fixtures.getAcolytes, ws.readAcolytes)
	})

	it('should read alerts', () => {
		runStandardTests('alerts', fixtures.getAlerts, ws.readAlerts, true)
	})

	it('should read bounties', () => {
		runStandardTests(
			'bounties',
			fixtures.getBounties,
			() => {
				ws.readGoals()
				ws.readSyndicateMissions()
			},
			true,
		)
	})

	it('should read challenges', () => {
		runStandardTests('challenges', fixtures.getChallenges, ws.readChallenges, true)
	})

	it('should read daily deals', () => {
		runStandardTests('dailydeals', fixtures.getDailyDeals, ws.readDailyDeals, true)
	})

	it('should read day cycles', () => {
		// More of an algorithm test as very little data processing is going on
		const dataKey = 'daynight'
		for (const [data, time, expected] of fixtures.getDayNight()) {
			ws.readers.daynight.read(data)
			const result = JSON.parse(ws.get([dataKey]))[dataKey].data[0],
				cycleTime = (time - result.start) % result.length,
				isDay = cycleTime >= result.dayStart && cycleTime < result.dayEnd,
				cycleEnd = isDay
					? result.dayEnd
					: (cycleTime < result.dayStart
						? result.dayStart
						: result.dayStart + result.length)
			expect(isDay).toBe(expected.isDay)
			expect(cycleEnd - cycleTime).toBe(expected.cycleEnd)
		}
	})

	it('should read faction projects', () => {
		runStandardTests('factionprojects', fixtures.getFactionProjects, ws.readFactionProjects)
	})

	it('should skip unknown faction projects', () => {
		const dataKey = 'factionprojects'
		ws.readers[dataKey].read([10, 20, 30])
		const result = JSON.parse(ws.get([dataKey]))[dataKey]
		expect(result.data.length).toBe(2)
		ws.readers[dataKey].read([])
	})

	it('should read fomorians', () => {
		runStandardTests('fomorians', fixtures.getGoals, ws.readGoals, true)
	})

	it('should read invasions', () => {
		runStandardTests('invasions', fixtures.getInvasions, ws.readInvasions)
	})

	it('should read news', () => {
		runStandardTests('news', fixtures.getNews, ws.readNews)
	})

	it('should read sorties', () => {
		runStandardTests('sorties', fixtures.getSorties, ws.readSorties, true)
	})

	it('should read upgrades', () => {
		runStandardTests('upgrades', fixtures.getUpgrades, ws.readUpgrades, true)
	})

	it('should read void fissures', () => {
		runStandardTests('fissures', fixtures.getVoidFissures, ws.readVoidFissures, true)
	})

	it('should read void storms', () => {
		runStandardTests('voidstorms', fixtures.getVoidStorms, ws.readVoidStorms, true)
	})

	it('should read void traders', () => {
		runStandardTests('voidtraders', fixtures.getVoidTraders, ws.readVoidTraders, true)
	})

	it('should load extra data', () => {
		extraData.data = {}
		extraData.load('data/extradata.json')
		expect(extraData.data.bounties.length).toBe(1)
		expect(extraData.getData('bounties')).toEqual(extraData.data.bounties)
		expect(extraData.getData('x')).toEqual([])
		extraData.data = {}
	})

	it('should load extra bounties and clear them if data file is removed', () => {
		extraData.data = {}
		const dataKey = 'bounties'
		let timestamp = fixtures.timeNowShort
		setWorldstateData({}, timestamp)
		for (const [dataPath, expected] of fixtures.getExtraBounties()) {
			extraData.load(dataPath)
			ws.readSyndicateMissions()
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data).toEqual(expected)
			timestamp += fixtures.timeStep
		}
		extraData.data = {}
	})
})

describe('Worldstate fetcher', () => {
	const mockGame = new MockGame()

	beforeAll(done => {
		config.wsUrl = `http://mockUsername:mockPassword@${mockGame.host}:${mockGame.port}`
		mockGame.start(done)
	})

	afterAll(done => {
		config.wsUrl = ''
		mockGame.shutdown(done)
	})

	it('should request worldstate data', async () => {
		const ws = new Worldstate(new Database('test'))
		const waitForFlush = new Promise(resolve => {
			ws.flushDb = () => resolve()
		})
		const timestamp = fixtures.timeNowShort
		const [[testData, expected]] = fixtures.getAlerts()
		mockGame.setData(testData, timestamp)
		const requestHeadersPromise = mockGame.getRequestHeaders()
		ws.start()
		await waitForFlush
		const requestHeaders = await requestHeadersPromise
		expect(requestHeaders['authorization']).toBe(`Basic ${btoa('mockUsername:mockPassword')}`)
		expect(requestHeaders['accept-encoding']).toBe('gzip, deflate')
		expect(requestHeaders['user-agent']).toBe(config.userAgent)
		const result = JSON.parse(ws.get(['alerts']))
		expect(result.time).toEqual(timestamp)
		expect(result.alerts.time).toBeGreaterThanOrEqual(timestamp)
		expect(result.alerts.data).toEqual([expected])
	}, 1000)

	it('should ignore old worldstate data', async () => {
		const ws = new Worldstate(new Database('test'))
		const waitForFlush = new Promise(resolve => {
			ws.flushDb = () => resolve()
		})
		const dataGenerator = fixtures.getAlerts()
		const readWorldstateSpy = spyOn(ws, 'readWorldstate').and.callThrough()

		const [dataFirst] = dataGenerator.next().value
		mockGame.setData(dataFirst, fixtures.timeNowShort)
		ws.start()
		await waitForFlush
		expect(readWorldstateSpy).toHaveBeenCalledTimes(1)
		readWorldstateSpy.calls.reset()

		const [dataSecond] = dataGenerator.next().value
		mockGame.setData(dataSecond, fixtures.timeNowShort - fixtures.timeStep)
		ws.requestWorldstate()
		await new Promise(resolve => {
			setTimeout(resolve, 100)
		})
		expect(readWorldstateSpy).not.toHaveBeenCalled()
	}, 1000)
})
