const config = require('../out/config').default
const Database = require('../out/db').default
const Worldstate = require('../out/worldstate').default
const fixtures = require('./deps/fixtures')
const extraData = require('../out/extradata').default

describe('Worldstate', () => {
	const ws = new Worldstate(new Database('pc'), 'pc')

	function runStandardTests(dataKey, timestamp, testCaseGenerator, worldstateReader, dataTransformer) {
		for (const [data, expected] of testCaseGenerator()) {
			setWorldstateData(dataTransformer ? dataTransformer(data) : data, timestamp)
			worldstateReader.call(ws)
			const result = JSON.parse(ws.get([dataKey]))
			expect(result[dataKey].data).toEqual(Array.isArray(expected) ? expected : [expected])
			timestamp += fixtures.timeStep
		}
	}

	function setWorldstateData(data, timestamp) {
		ws.ws = data
		ws.now = timestamp
	}

	beforeAll(() => {
		ws.start()
	})

	it('should read acolytes', () => {
		runStandardTests('acolytes', fixtures.timeNowShort, fixtures.getAcolytes, ws.readAcolytes)
	})

	it('should read alerts', () => {
		runStandardTests('alerts', fixtures.timeNowShort, fixtures.getAlerts, ws.readAlerts)
	})

	it('should read bounties', () => {
		runStandardTests(
			'bounties',
			fixtures.timeNowShort,
			fixtures.getBounties,
			() => {
				ws.readGoals()
				ws.readSyndicateMissions()
			}
		)
	})

	it('should read challenges', () => {
		runStandardTests('challenges', fixtures.timeNowShort, fixtures.getChallenges, ws.readChallenges)
	})

	it('should read daily deals', () => {
		runStandardTests('dailydeals', fixtures.timeNowShort, fixtures.getDailyDeals, ws.readDailyDeals)
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
			expect(isDay).toEqual(expected.isDay)
			expect(cycleEnd - cycleTime).toEqual(expected.cycleEnd)
		}
	})

	it('should read faction projects', () => {
		runStandardTests('factionprojects', fixtures.timeNowShort, fixtures.getFactionProjects, ws.readFactionProjects)
	})

	it('should read fomorians', () => {
		runStandardTests('fomorians', fixtures.timeNowShort, fixtures.getGoals, ws.readGoals)
	})

	it('should read invasions', () => {
		runStandardTests('invasions', fixtures.timeNowShort, fixtures.getInvasions, ws.readInvasions)
	})

	it('should read news', () => {
		runStandardTests('news', fixtures.timeNowShort, fixtures.getNews, ws.readNews)
	})

	it('should read sentient anomalies', () => {
		runStandardTests(
			'sentient-anomalies',
			fixtures.timeNowShort,
			fixtures.getSentientAnomalies,
			ws.readSentientAnomalies,
			data => ({ Tmp: JSON.stringify(data) })
		)
	})

	it('should read sorties', () => {
		runStandardTests('sorties', fixtures.timeNowShort, fixtures.getSorties, ws.readSorties)
	})

	it('should read upgrades', () => {
		runStandardTests('upgrades', fixtures.timeNowShort, fixtures.getUpgrades, ws.readUpgrades)
	})

	it('should read void fissures', () => {
		runStandardTests('fissures', fixtures.timeNowShort, fixtures.getVoidFissures, ws.readVoidFissures)
	})

	it('should read void traders', () => {
		runStandardTests('voidtraders', fixtures.timeNowShort, fixtures.getVoidTraders, ws.readVoidTraders)
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

	it('should load extra bounties', () => {
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
