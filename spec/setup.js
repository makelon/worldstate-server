import { dirname } from 'path'
import { fileURLToPath } from 'url'

import config from '../out/config.js'
import { load as loadItems } from '../out/items.js'
import * as log from '../out/log.js'
import { load as loadTags } from '../out/tags.js'

process.chdir(dirname(fileURLToPath(import.meta.url)))

config.load('data/config.tests.json')
log.setLevel('none')
log.setTimestamps(false)
loadItems('data/rewardtables.json', 'data/rewardtables-rotations.json', 'data/itemnames.json', 'data/itemtypes.json')
loadTags('data/starchart.json', 'data/challenges.json', 'data/translations.json')
