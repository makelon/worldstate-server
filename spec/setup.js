const config = require('../out/config').default
const items = require('../out/items')
const log = require('../out/log')
const tags = require('../out/tags')

process.chdir(__dirname)

config.load('data/config.tests.json')
log.setLevel('warning')
log.setTimestamps(false)
items.load('data/rewardtables.json', 'data/rewardtables-rotations.json', 'data/itemnames.json', 'data/itemtypes.json')
tags.load('data/starchart.json', 'data/challenges.json')
