const config = require('../out/config').default
const Database = require('../out/db').default
const extraData = require('../out/extradata').default
const Worldstate = require('../out/worldstate').default
const fixtures = require('./fixtures/data')

describe('Worldstate', () => {
	const ws = new Worldstate(new Database('pc'), 'pc')

	function runStandardTests(dataKey, testCaseGenerator, worldstateReader, includeExpireTest, dataTransformer) {
		let timestamp = fixtures.timeNowShort
		for (const [data, expected] of testCaseGenerator()) {
			setWorldstateData(dataTransformer ? dataTransformer(data) : data, timestamp)
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

	beforeAll(() => {
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

	it('should read sentient anomalies', () => {
		runStandardTests(
			'sentient-anomalies',
			fixtures.getSentientAnomalies,
			ws.readSentientAnomalies,
			false,
			data => ({ Tmp: JSON.stringify(data) }),
		)
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

	it('should read void traders', () => {
		runStandardTests('voidtraders', fixtures.getVoidTraders, ws.readVoidTraders, true)
	})

	it('should load extra data', () => {
		config.wsUrls.pc = ''
		extraData.data = {}
		extraData.load('data/extradata.json')
		expect(extraData.data.pc.bounties.length).toBe(1)
		expect(extraData.getData('pc', 'bounties')).toEqual(extraData.data.pc.bounties)
		expect(extraData.getData('pc', 'x')).toEqual([])
		expect(extraData.getData('x', 'bounties')).toEqual([])
		extraData.data = {}
		delete config.wsUrls.pc
	})

	it('should load extra bounties and clear them if data file is removed', () => {
		config.wsUrls.pc = ''
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
		delete config.wsUrls.pc
	})
})
