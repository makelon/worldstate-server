const items = [
		{
			id: 'MockItemType',
			name: 'Mock Item',
			type: 'Cosmetic'
		},
		{
			id: 'MockItemType2',
			name: 'Mock Item 2',
			type: 'Companion'
		},
		{
			id: 'NonexistentItem',
			name: 'NonexistentItem',
			type: 'Misc'
		}
	]
	itemRewards = {
		input: {
			credits: 6500,
			items: [ items[0].id ]
		},
		output: {
			credits: 6500,
			items: [ { name: items[0].name, type: items[0].type, count: 1 } ]
		}
	},
	countedItemRewards = {
		input: [ { ItemType: items[1].id, ItemCount: 3 } ],
		output: {
			items: [ { name: items[1].name, type: items[1].type, count: 3 } ]
		}
	},
	rewardTables = [
		{
			input: 'MockRewardTable',
			output: [
				[ { name: items[0].name, type: items[0].type, count: 15, chance: 1 } ],
				[ { name: 'Endo', type: 'Endo', count: 50, chance: 1 } ]
			]
		},
		{
			input: 'MockRewardTable',
			output: [
				[ { name: items[0].name, type: items[0].type, count: 25, chance: 1 } ],
				[ { name: 'Endo', type: 'Endo', count: 60, chance: 1 } ]
			]
		},
		{
			input: 'MockRewardTable',
			output: [
				[ { name: items[0].name, type: items[0].type, count: 35, chance: 1 } ],
				[ { name: 'Endo', type: 'Endo', count: 70, chance: 1 } ]
			]
		}
	],
	acolyteRewardTables = {
		Torment: [
			[ { name: items[0].name, type: items[0].type, count: 15, chance: 1 } ]
		]
	},
	challenges = [
		{
			input: 'Challenge1000',
			output: { description: 'Test challenge 1000 standing', xpAmount: 1000 }
		},
		{
			input: 'Challenge5000',
			output: { description: 'Test challenge 5000 standing', xpAmount: 5000 }
		}
	],
	entityRewardTables = {
		[items[0].name]: [
			[
				{ name: items[0].name, type: items[0].type, count: 1, chance: 0.3 },
				{ name: items[1].name, type: items[1].type, count: 5, chance: 0.7 }
			]
		]
	},
	entryId = '5b291c5825666c0225476ac6',
	factions = [
		{
			id: 'FC_GRINEER',
			name: 'Grineer'
		},
		{
			id: 'FC_CORPUS',
			name: 'Corpus'
		}
	],
	missionTypes = [
		{
			id: 'MT_CAPTURE',
			name: 'Capture',
		},
		{
			id: 'MT_INTEL',
			name: 'Spy',
		}
	],
	nodes = [
		{
			id: 'SolNode1',
			name: 'Location1'
		},
		{
			id: 'SolNode2',
			name: 'Location2'
		}
	],
	timeNowLong = Date.now(),
	timeNowShort = Math.floor(timeNowLong / 1000),
	timeStartLong = timeNowLong - 300e3,
	timeEndLong = timeNowLong + 300e3,
	timeStartShort = Math.floor(timeStartLong / 1000),
	timeEndShort = Math.floor(timeEndLong / 1000),
	timeStep = 40

function* getAcolytes() {
	let timeLocalShort = timeNowShort
	const acolyte = {
			_id: { $oid: entryId },
			LocTag: '/Lotus/Language/Game/ControlAcolyte',
			HealthPercent: 0.75,
			LastDiscoveredLocation: nodes[0].id,
			Discovered: false,
		},
		expected = {
			id: entryId,
			name: 'Torment',
			health: 0.75,
			healthHistory: [[timeLocalShort, 0.75]],
			discovered: false,
			location: nodes[0].name,
			rewards: acolyteRewardTables['Torment']
		},
		data = { PersistentEnemies: [acolyte] }
	yield [data, expected]

	timeLocalShort += timeStep
	acolyte.HealthPercent -= 0.005
	acolyte.Discovered = true
	expected.discovered = true
	expected.health = acolyte.HealthPercent
	expected.healthHistory.push([-timeLocalShort, acolyte.HealthPercent])
	yield [data, expected]

	timeLocalShort += timeStep
	acolyte.HealthPercent -= 0.0025
	expected.health = acolyte.HealthPercent
	expected.healthHistory[1] = [-timeLocalShort, acolyte.HealthPercent]
	yield [data, expected]

	timeLocalShort += timeStep
	acolyte.HealthPercent = 0.5
	expected.health = acolyte.HealthPercent
	expected.healthHistory[1] = [timeLocalShort, acolyte.HealthPercent]
	yield [data, expected]

	acolyte.LocTag = 'RogueAcolyte'
	expected.name = 'Mania'
	expected.rewards = []
	yield [data, expected]
}

function* getAlerts() {
	const alert = {
			_id: { $oid: entryId },
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			MissionInfo: {
				missionType: missionTypes[0].id,
				faction: factions[0].id,
				location: nodes[0].id,
				minEnemyLevel: 15,
				maxEnemyLevel: 17,
				maxWaveNum: 10,
				missionReward: {
					credits: 6500
				}
			}
		},
		expected = {
			id: entryId,
			start: timeStartShort,
			end: timeEndShort,
			location: nodes[0].name,
			missionType: missionTypes[0].name,
			faction: factions[0].name,
			minLevel: 15,
			maxLevel: 17,
			missionLength: 10,
			rewards: {
				credits: 6500
			}
		},
		data = { Alerts: [alert] }
	yield [data, expected]

	alert.MissionInfo.faction = factions[1].id
	expected.faction = factions[1].name
	yield [data, expected]

	alert.MissionInfo.missionReward = itemRewards.input
	expected.rewards = itemRewards.output
	yield [data, expected]

	delete alert.MissionInfo.missionReward.items
	delete expected.rewards.items
	yield [data, expected]
}

function* getBounties() {
	let timeLocalShort = timeNowShort
	const bountySyndicate = {
			_id: { $oid: entryId },
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			Tag: 'CetusSyndicate',
			Jobs: [
				{
					rewards: rewardTables[1].input,
					minEnemyLevel: 5,
					maxEnemyLevel: 15,
					xpAmounts: [100, 300]
				},
			]
		},
		expectedSyndicate = {
			id: entryId,
			start: timeStartShort,
			end: timeEndShort,
			syndicate: 'Ostron',
			jobs: [
				{
					rewards: rewardTables[1].output,
					rotation: 'B',
					minLevel: 5,
					maxLevel: 15,
					xpAmounts: [100, 300]
				}
			]
		},
		bountyInfested = {
			_id: { $oid: entryId + '2' },
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			Tag: 'InfestedPlains',
			Jobs: [
				{
					rewards: rewardTables[1].input,
					minEnemyLevel: 10,
					maxEnemyLevel: 20,
					xpAmounts: [200, 400]
				},
			]
		},
		expectedInfested = {
			id: entryId + '2',
			start: timeStartShort,
			end: timeEndShort,
			syndicate: 'Plague Star',
			jobs: [
				{
					rewards: rewardTables[1].output,
					minLevel: 10,
					maxLevel: 20,
					xpAmounts: [200, 400]
				}
			]
		},
		bountyGhoul = {
			_id: { $oid: entryId + '3' },
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			Tag: 'GhoulEmergence',
			HealthPct: 0.9,
			VictimNode: nodes[1].id,
			Jobs: [
				{
					rewards: rewardTables[2].input,
					minEnemyLevel: 15,
					maxEnemyLevel: 25,
					xpAmounts: [250, 450]
				},
			]
		},
		expectedGhoul = {
			id: entryId + '3',
			start: timeStartShort,
			end: timeEndShort,
			syndicate: 'Ghoul Purge',
			health: 0.9,
			healthHistory: [[timeStartShort, 1], [timeNowShort, 0.9]],
			location: nodes[1].name,
			jobs: [
				{
					rewards: rewardTables[2].output,
					rotation: 'C',
					minLevel: 15,
					maxLevel: 25,
					xpAmounts: [250, 450]
				}
			]
		},
		data = { Goals: [bountyGhoul], SyndicateMissions: [bountySyndicate] },
		expected = [expectedGhoul, expectedSyndicate]
	yield [data, expected]

	timeLocalShort += timeStep
	bountyGhoul.HealthPct = 0.4
	bountyGhoul.VictimNode = nodes[0].id
	data.Goals.push(bountyInfested)
	expected.push(expectedInfested)
	expectedGhoul.health = bountyGhoul.HealthPct
	expectedGhoul.healthHistory.push([timeLocalShort, bountyGhoul.HealthPct])
	expectedGhoul.location = nodes[0].name
	yield [data, expected]
}

function* getChallenges() {
	const challenge = {
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			AffiliationTag: 'RadioLegionSyndicate',
			Season: 3,
			Phase: 7,
			ActiveChallenges: [
				{
					Activation: { $date: { $numberLong: timeStartLong } },
					Expiry: { $date: { $numberLong: timeEndLong } },
					_id: { $oid: entryId },
					Daily: true,
					Challenge: challenges[0].input
				},
			]
		},
		expected = {
			id: 'RadioLegionSyndicate' + timeEndShort,
			start: timeStartShort,
			end: timeEndShort,
			syndicate: 'Nightwave',
			season: 3,
			phase: 7,
			challenges: [
				{
					id: entryId,
					start: timeStartShort,
					end: timeEndShort,
					daily: true,
					description: challenges[0].output.description,
					xpAmount: challenges[0].output.xpAmount
				}
			]
		},
		data = { SeasonInfo: challenge }
	yield [data, expected]

	delete challenge.ActiveChallenges[0].Daily
	challenge.ActiveChallenges[0].Challenge = challenges[1].input
	expected.challenges[0].daily = false
	expected.challenges[0].description = challenges[1].output.description
	expected.challenges[0].xpAmount = challenges[1].output.xpAmount
	yield [data, expected]
}

function* getDailyDeals() {
	const deal = {
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			StoreItem: items[0].id,
			Discount: 70,
			OriginalPrice: 125,
			SalePrice: 38,
			AmountTotal: 200,
			AmountSold: 125
		},
		expected = {
			id: timeStartShort.toString(),
			start: timeStartShort,
			end: timeEndShort,
			item: { name: items[0].name, type: items[0].type },
			price: 38,
			originalPrice: 125,
			stock: 200,
			sold: 125
		},
		data = { DailyDeals: [deal] }
	yield [data, expected]

	deal.StoreItem = items[1].id
	expected.item = { name: items[1].name, type: items[1].type }
	yield [data, expected]
}

function* getDayNight() {
	const dayNight = {
			id: "cetus",
			start: 1542131224,
			length: 1600,
			dayStart: 800,
			dayEnd: 1200
		},
		expected = {},
		data = [dayNight]
	expected.cycleEnd = 123
	expected.isDay = false
	yield [data, dayNight.start - expected.cycleEnd + dayNight.dayStart, expected]

	expected.cycleEnd = 234
	expected.isDay = true
	yield [data, dayNight.start - expected.cycleEnd + dayNight.dayEnd, expected]

	expected.cycleEnd = 345
	expected.isDay = false
	yield [data, dayNight.start - expected.cycleEnd + dayNight.length + dayNight.dayStart, expected]

	dayNight.dayStart = 0
	expected.isDay = true
	yield [data, dayNight.start - expected.cycleEnd + dayNight.dayEnd, expected]
}

function* getExtraBounties() {
	const expectedSyndicate = {
		id: 'ExtraBounty',
		start: 0,
		end: 0,
		syndicate: 'Extra Bounty Syndicate',
		jobs: [
			{
				rewards: rewardTables[0].output,
				minLevel: 3,
				maxLevel: 8,
				xpAmounts: [1234],
				title: 'Extra Bounty Title'
			}
		]
	}
	yield ['data/extradata.json', [expectedSyndicate]];
	yield ['data/nonexistent.json', []];
}

function* getFactionProjects() {
	let timeLocalShort = timeNowShort
	const projects = [25],
		expected = {
			id: '0',
			type: 'Balor Fomorian',
			progress: projects[0],
			progressHistory: [[timeLocalShort, projects[0]]]
		},
		data = {
			ProjectPct: projects
		}
	yield [data, expected]

  // Small increment should add volatile record
	timeLocalShort += timeStep
	projects[0] += 0.25
	expected.progress = projects[0]
	expected.progressHistory.push([-timeLocalShort, projects[0]])
	yield [data, expected]

  // Small increment should update volatile record
	timeLocalShort += timeStep
	projects[0] += 0.25
	expected.progress = projects[0]
	expected.progressHistory[1] = [-timeLocalShort, projects[0]]
	yield [data, expected]

  // Small decrement should be ignored
	timeLocalShort += timeStep
	projects[0] -= 0.5
	yield [data, expected]

  // Large increment should make last record permanent
	timeLocalShort += timeStep
	projects[0] = 35
	expected.progress = projects[0]
	expected.progressHistory[1] = [timeLocalShort, projects[0]]
	yield [data, expected]

  // Large decrement should reset progress history
	timeLocalShort += timeStep
	projects[0] = 15
	expected.progress = projects[0]
	expected.progressHistory = [[timeLocalShort, projects[0]]]
	yield [data, expected]
}

function* getGoals() {
	let timeLocalShort = timeNowShort
	const fomorian = {
			_id: { $oid: entryId },
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			Fomorian: true,
			Goal: 3,
			HealthPct: 0.75,
			VictimNode: nodes[0].id,
			Faction: factions[1].id,
			MissionInfo: {
				missionType: missionTypes[0].id,
				location: nodes[1].id,
				minEnemyLevel: 20,
				maxEnemyLevel: 30,
				requiredItems: [items[0].id],
				missionReward: { randomizedItems: rewardTables[0].input },
			},
			Reward: itemRewards.input
		},
		expected = {
			id: entryId,
			start: timeStartShort,
			end: timeEndShort,
			type: 'Razorback',
			health: 0.75,
			healthHistory: [[timeStartShort, 1], [timeLocalShort, 0.75]],
			endGoal: 3,
			missionType: missionTypes[0].name,
			victimLocation: nodes[0].name,
			missionLocation: nodes[1].name,
			requiredItems: [ { name: items[0].name, type: items[0].type } ],
			goalRewards: itemRewards.output,
			randomRewards: rewardTables[0].output
		},
		data = { Goals: [fomorian] }
	yield [data, expected]

	timeLocalShort += timeStep
	fomorian.HealthPct -= 0.0025
	expected.health = fomorian.HealthPct
	expected.healthHistory.push([-timeLocalShort, fomorian.HealthPct])
	yield [data, expected]

	timeLocalShort += timeStep
	fomorian.HealthPct = 0.5
	expected.health = fomorian.HealthPct
	expected.healthHistory[2] = [timeLocalShort, fomorian.HealthPct]
	yield [data, expected]

	fomorian.VictimNode = nodes[1].id
	expected.victimLocation = nodes[1].name
	yield [data, expected]
}

function* getInvasions() {
	let timeLocalShort = timeNowShort
	const invasion = {
			_id: { $oid: entryId },
			Node: nodes[0].id,
			Count: 0,
			Goal: 1000,
			AttackerReward: { countedItems: countedItemRewards.input },
			AttackerMissionInfo: { faction: factions[0].id },
			DefenderReward: { countedItems: countedItemRewards.input },
			DefenderMissionInfo: { faction: factions[1].id },
			Activation: { $date: { $numberLong: timeStartLong } }
		},
		expected = {
			id: entryId,
			start: timeStartShort,
			location: nodes[0].name,
			endScore: 1000,
			score: 0,
			scoreHistory: [[timeStartShort, 0]],
			factionAttacker: factions[1].name,
			factionDefender: factions[0].name,
			rewardsAttacker: countedItemRewards.output,
			rewardsDefender: countedItemRewards.output
		},
		data = { Invasions: [invasion] }
	yield [data, expected]

	timeLocalShort += timeStep
	invasion.Count = 2
	expected.score = invasion.Count
	expected.scoreHistory.push([-timeLocalShort, invasion.Count])
	yield [data, expected]

	timeLocalShort += timeStep
	invasion.Count = 3
	expected.score = invasion.Count
	expected.scoreHistory[1] = [-timeLocalShort, invasion.Count]
	yield [data, expected]

	timeLocalShort += timeStep
	invasion.Count = -1
	expected.score = invasion.Count
	expected.scoreHistory[1][0] *= -1 // Store local maximum
	expected.scoreHistory.push(
		[timeLocalShort - timeStep * 1 / 4, 0], // Score=0 interpolation
		[-timeLocalShort, invasion.Count]
	)
	yield [data, expected]

	timeLocalShort += timeStep
	invasion.Count = -30
	expected.score = invasion.Count
	expected.scoreHistory[3] = [timeLocalShort, invasion.Count]
	yield [data, expected]

	timeLocalShort += timeStep
	invasion.Count += -30
	expected.score = invasion.Count
	expected.scoreHistory.push([timeLocalShort, invasion.Count])
	yield [data, expected]

	invasion.AttackerReward = undefined
	delete expected.rewardsAttacker
	yield [data, expected]
}

function* getKuvalog() {
	const timeStartStr = new Date(timeStartLong).toISOString(),
		timeEndStr = new Date(timeEndLong).toISOString(),
		data = [
			{
				start: timeStartStr,
				end: timeEndStr,
				missiontype: 'KuvaMission6',
				solnode: nodes[0].id,
				realtime: timeStartStr
			},
			{
				start: timeStartStr,
				end: timeEndStr,
				missiontype: 'EliteAlertMission',
				solnode: nodes[1].id,
				realtime: timeStartStr
			}
		],
		expectedArbitration = {
			id: timeStartShort.toString(),
			start: timeStartShort,
			end: timeEndShort,
			faction: factions[1].name,
			location: nodes[1].name,
			missionType: missionTypes[1].name,
			rewards: rewardTables[0].output
		},
		expectedKuvamission = {
			id: 'KuvaMission6' + timeStartShort.toString(),
			start: timeStartShort,
			end: timeEndShort,
			faction: factions[0].name,
			location: nodes[0].name,
			missionType: missionTypes[0].name,
			flood: false,
			rewards: rewardTables[1].output
		}
	yield [data, expectedArbitration, expectedKuvamission]

	data[1].end = new Date(timeStartLong + 4800e3).toISOString()
	expectedArbitration.end = timeStartShort + 3600
	yield [data, expectedArbitration, expectedKuvamission]
}

function* getNews() {
	const article = {
			_id: { $oid: entryId },
			Messages: [
				{
					LanguageCode: 'en',
					Message: 'Free tests!'
				}
			],
			Prop: 'news_link',
			Date: { $date: { $numberLong: timeStartLong - 100000} },
			EventStartDate: { $date: { $numberLong: timeStartLong } },
			EventEndDate: { $date: { $numberLong: timeEndLong } },
			EventLiveUrl: 'event_live_url',
			ImageUrl: 'image_url',
			Priority: false,
			MobileOnly: false
		},
		expected = {
			id: entryId,
			start: timeStartShort - 100,
			text: 'Free tests!',
			link: 'news_link',
			eventStart: timeStartShort,
			eventEnd: timeEndShort,
			eventUrl: 'event_live_url'
		},
		data = { Events: [article] }
	yield [data, expected]

	article.Messages[0].Message = 'More free tests!'
	expected.text = article.Messages[0].Message
	yield [data, expected]
}

function* getSorties() {
	const sortie = {
			_id: { $oid: entryId },
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			Boss: 'SORTIE_BOSS_VOR',
			Reward: rewardTables[0].input,
			Variants: [ { missionType: missionTypes[0].id, modifierType: 'SORTIE_MODIFIER_EXIMUS', node: nodes[0].id, } ]
		},
		expected = {
			id: entryId,
			start: timeStartShort,
			end: timeEndShort,
			faction: factions[0].name,
			bossName: 'Vor',
			rewards: rewardTables[0].output,
			missions: [ { missionType: missionTypes[0].name, modifier: 'Eximus stronghold', location: nodes[0].name } ]
		},
		data = { Sorties: [sortie] }
	yield [data, expected]

	sortie.Boss = 'SORTIE_BOSS_JACKAL'
	expected.bossName = 'Jackal'
	expected.faction = factions[1].name
	yield [data, expected]
}

function* getUpgrades() {
	const upgrade = {
			_id: { $id: entryId },
			Activation: { sec: timeStartShort, usec: 0 },
			ExpiryDate: { sec: timeEndShort, usec: 0 },
			UpgradeType: 'GAMEPLAY_KILL_XP_AMOUNT',
			OperationType: 'MULTIPLY',
			Value: 2,
		},
		expected = {
			id: entryId,
			start: timeStartShort,
			end: timeEndShort,
			type: 'Affinity',
			opType: 'MULTIPLY',
			value: 2
		},
		data = { GlobalUpgrades: [upgrade] }
	yield [data, expected]

	upgrade.Activation.sec = timeStartShort - 1000
	expected.start = upgrade.Activation.sec
	yield [data, expected]
}

function* getVoidFissures() {
	const fissure = {
			_id: { $oid: entryId },
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			Node: nodes[0].id,
			Modifier: 'VoidT1'
		},
		expected = {
			id: entryId,
			start: timeStartShort,
			end: timeEndShort,
			location: nodes[0].name,
			faction: factions[0].name,
			missionType: missionTypes[0].name,
			tier: 'Lith'
		},
		data = { ActiveMissions: [fissure] }
	yield [data, expected]

	fissure.Expiry.$date.$numberLong += 500000
	expected.end += 500
	yield [data, expected]
}

function* getVoidTraders() {
	const voidTrader = {
			_id: { $oid: entryId },
			Activation: { $date: { $numberLong: timeStartLong } },
			Expiry: { $date: { $numberLong: timeEndLong } },
			Character: 'Baro\'Ki Teel',
			Node: nodes[0].id,
			Manifest: [ { ItemType: items[0].id, PrimePrice: 4, RegularPrice: 9 } ]
		},
		expected = {
			id: entryId + timeStartShort.toString(),
			start: timeStartShort,
			end: timeEndShort,
			name: 'Baro Ki\'Teer',
			location: nodes[0].name,
			active: true,
			items: [ { name: items[0].name, type: items[0].type, ducats: 4, credits: 9 } ]
		},
		data = { VoidTraders: [voidTrader] }
	yield [data, expected]

	voidTrader.Node = nodes[1].id
	voidTrader.Manifest[0].PrimePrice = 5
	expected.location = nodes[1].name
	expected.items[0].ducats = 5
	yield [data, expected]

	voidTrader.Activation.$date.$numberLong = timeEndLong
	expected.id = entryId + timeEndShort.toString()
	expected.start = timeEndShort
	expected.active = false
	delete expected.items
	yield [data, expected]
}

module.exports = {
	timeNowShort,
	timeStartShort,
	timeStartLong,
	timeEndShort,
	timeEndLong,
	timeStep,
	items,
	itemRewards,
	entityRewardTables,
	rewardTables,
	entryId,
	factions,
	missionTypes,
	nodes,
	getAcolytes,
	getAlerts,
	getBounties,
	getChallenges,
	getDailyDeals,
	getDayNight,
	getExtraBounties,
	getFactionProjects,
	getGoals,
	getInvasions,
	getKuvalog,
	getNews,
	getSorties,
	getUpgrades,
	getVoidFissures,
	getVoidTraders
}
