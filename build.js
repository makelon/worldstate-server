const cproc = require('child_process'),
	fs = require('fs'),
	os = require('os'),
	path = require('path'),
	readline = require('readline'),
	EventEmitter = require('events').EventEmitter

process.chdir(__dirname)

const dataFiles = {
		rewardTables: [
			'./data/rewardtables-bounties.json',
			'./data/rewardtables-dynamic.json',
			'./data/rewardtables-sorties.json',
			'./data/rewardtables-extra.json'
		],
		itemNames: './data/itemnames.json',
		itemTypes: './data/itemtypes.json',
		solarMap: './data/starchart.json'
	},
	opt = {},
	outDir = './out'
let tscPath,
	tsc,
	server,
	watcher

function printErrors(data) {
	printLines('\u001b[91m[Error]   ', data, true)
}

function printBuild(data) {
	printLines('\u001b[93m[Build]   ', data)
}

function printServer(data) {
	printLines('\u001b[96m[Server]  ', data)
}

function printLines(prefix, data, colorData) {
	const date = new Date(),
		timeMillis = date.getMilliseconds()
	let postfix,
		timeString = `\u001b[97m${date.toLocaleTimeString()}.`
	if (timeMillis < 10) {
		timeString += '00'
	}
	else if (timeMillis < 100) {
		timeString += '0'
	}
	timeString += timeMillis.toString() + ' '
	if (colorData) {
		postfix = '\u001b[0m'
	}
	else {
		prefix += '\u001b[0m'
		postfix = ''
	}
	for (line of data.split('\n')) {
		if (line.trim() !== '') {
			process.stdout.write(timeString + prefix + line + postfix + os.EOL)
		}
	}
}

function build() {
	try {
		fs.mkdirSync(outDir)
	}
	catch (err) {
		if (err.code != 'EEXIST') {
			printErrors(err.message)
			process.exit()
		}
	}

	if (!opt.watch && opt.data) {
		buildData()
	}
	if (opt.watch || opt.build) {
		printBuild('Compiling project')
		let tscArgs = [tscPath, '--outDir', outDir]
		if (opt.sMaps) {
			tscArgs.push('--sourceMap')
		}
		if (opt.watch) {
			tscArgs.push('-w')
		}
		tsc = cproc.spawn(process.argv0, tscArgs)
		if (opt.watch) {
			watcher = {
				timer: 0,
				ee: new EventEmitter(),
			}
			const watch = []
			for (const key in dataFiles) {
				if (typeof dataFiles[key] == 'string') {
					watch.push(dataFiles[key])
				}
				else {
					watch.push(...dataFiles[key])
				}
			}
			for (const file of watch) {
				try {
					fs.watch(file, (eventType, filename) => {
						if (watcher.timer) {
							clearTimeout(watcher.timer)
							watcher.timer = 0
						}
						watcher.timer = setTimeout(buildData, 200)
					})
				}
				catch (err) {}
			}
			buildData()
		}
		const reBuildError = /^.+\(\d+,\d+\): error/,
			reBuildIndent = /^  /,
			reBuildTimestamp = /^\d\d:\d\d:\d\d - /,
			reBuildComplete = /Watching for file changes.$/
		let buildErrors = false
		tsc.stdout.setEncoding('utf8')
			.on('data', data => {
				for (line of data.split('\n')) {
					if (line.trim() === '' || line == '\x1bc') {
						continue
					}
					if (reBuildError.test(line)) {
						buildErrors = true
						printErrors(line)
						continue
					}
					if (buildErrors && reBuildIndent.test(line)) {
						printErrors(line)
						continue
					}
					if (reBuildTimestamp.test(line)) {
						line = line.substr(11)
					}
					printBuild(line)
					if (opt.run && opt.watch && reBuildComplete.test(line)) {
						if (buildErrors) {
							buildErrors = false
							return
						}
						if (watcher.timer) {
							watcher.ee.once('done', postBuild)
						}
						else {
							postBuild()
						}
					}
				}
			})
		if (opt.run && !opt.watch) {
			tsc.on('close', () => {
				if (!buildErrors) {
					startServer(opt.watch)
				}
			})
		}
	}
	else if (opt.run) {
		startServer(false)
	}
}

function buildData() {
	printBuild('Building data files')
	Promise.all([
		buildRewardTables(),
		copyFile(dataFiles.itemNames),
		copyFile(dataFiles.itemTypes),
		copyFile(dataFiles.solarMap)
	]).then(() => {
		if (watcher) {
			watcher.ee.emit('done')
		}
		printBuild('Data files built')
	}).catch(err => {
		printErrors(err.message)
	})
}

function buildRewardTables() {
	const promises = []
	for (const f of dataFiles.rewardTables) {
		promises.push(new Promise((resolve, reject) => {
			fs.readFile(f, 'utf8', (err, content) => {
				if (err) {
					reject(err)
					return
				}
				try {
					resolve(JSON.parse(content))
				}
				catch (e) {
					reject(e)
				}
			})
		}))
	}
	return Promise.all(promises)
		.then(inputs => new Promise((resolve, reject) => {
			const rewardTables = {}
			for (const table of inputs) {
				for (const key in table) {
					rewardTables[key] = table[key]
				}
			}
			fs.writeFile(path.join(outDir, 'rewardtables.json'), JSON.stringify(rewardTables), 'utf8', (err) => {
				if (err) {
					reject(err)
					return
				}
				resolve()
			})
		}))
}

function copyFile(filePath) {
	return new Promise((resolve, reject) => {
		const rs = fs.createReadStream(filePath),
			ws = fs.createWriteStream(path.join(outDir, path.basename(filePath)))
		rs.on('error', (err) => {
			printBuild(`!! Cannot open file ${filePath}`)
			ws.write('{}')
			resolve()
		})
		ws.on('error', reject)
		rs.pipe(ws).on('close', resolve)
	})
}

function postBuild() {
	if (server) {
		printBuild(`Restarting server ${server.pid}`)
		server.kill()
		// Restarted by exit handler
	}
	else {
		printBuild('Starting server')
		startServer(true)
	}
}

function startServer(restart) {
	server = cproc.spawn(process.argv0, ['index.js'], {
		cwd: path.join(process.cwd(), outDir)
	})
	server.stdout.setEncoding('utf8').on('data', printServer)
	server.stderr.setEncoding('utf8').on('data', printErrors)
	server.on('exit', (code, signal) => {
		if (code) {
			printErrors(`Server exited with error code ${code}`)
			server = null
		}
		else if (restart) {
			startServer(true)
		}
	}).on('error', err => {
		printErrors(err)
	})
	printBuild(`Server PID = ${server.pid}`)
}

try {
	tscPath = require.resolve('typescript/bin/tsc')
}
catch (err) {
	printErrors('Typescript compiler not found')
	process.exit()
}

for (const c of process.argv[2] || 'bd') {
	switch (c) {
		case 'b':
			opt.build = true
			break
		case 'd':
			opt.data = true
			break
		case 'r':
			opt.run = true
			break
		case 's':
			opt.sMaps = true
			break
		case 'w':
			opt.watch = true
			break
		default:
			console.log(
				'Usage: node build [bdrsw]\n' +
				'\n' +
				'	b	Build source files\n' +
				'	d	Build data files\n' +
				'	r	Run the server when build finishes\n' +
				'	s	Generate source maps during build process\n' +
				'	w	Watch for changes in source or data files\n'
			)
			process.exit()
	}
}

if (opt.data && !(fs.existsSync(dataFiles.itemNames) && fs.existsSync(dataFiles.itemTypes))) {
	console.log(
		'WARNING: itemnames.json or itemtypes.json is missing.\n' +
		'You probably want to put the following file in the folder "%s"\n' +
		'\n' +
		'	https://github.com/WFCD/warframe-worldstate-data/raw/master/data/languages.json\n' +
		'\n' +
		'and run the command\n' +
		'\n' +
		'	%s items\n',
		path.join(__dirname, 'data'),
		path.basename(process.argv0).replace(/\.exe$/, '')
	)
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	})
	rl.question('Continue anyway? [yN] ', (answer) => {
		if (answer.toLowerCase() == 'y') {
			build()
		}
		rl.close()
		process.stdin.destroy()
	})
}
else {
	build()
}
