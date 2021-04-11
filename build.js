const cproc = require('child_process'),
	fs = require('fs'),
	os = require('os'),
	path = require('path'),
	readline = require('readline'),
	EventEmitter = require('events').EventEmitter

process.chdir(__dirname)

const itemNames = 'itemnames.json',
	itemTypes = 'itemtypes.json',
	dataDir = 'data',
	dataFiles = {
		concat: [
			{
				input: [
					'rewardtables-cetus.json',
					'rewardtables-deimos.json',
					'rewardtables-solaris.json',
					'rewardtables-dynamic.json',
					'rewardtables-relics.json',
					'rewardtables-sorties.json',
					'rewardtables-extra.json',
				],
				output: 'rewardtables.json',
			},
			{
				input: [
					'rewardtables-cetus-rotations.json',
					'rewardtables-deimos-rotations.json',
					'rewardtables-solaris-rotations.json',
				],
				output: 'rewardtables-rotations.json',
			},
		],
		copy: [
			itemNames,
			itemTypes,
			'starchart.json',
			'daynight.json',
			'extradata.json',
			'challenges.json',
		],
	},
	opt = {},
	outDir = 'out'
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
		timeString = `\u001b[97m${date.toLocaleTimeString('en-US', { hour12: false })}.`
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
	for (const line of data.split('\n')) {
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
		if (err.code !== 'EEXIST') {
			printErrors(err.message)
			process.exit(1)
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
			tscArgs.push('-w', '--preserveWatchOutput')
			buildData().then(() => {
				watchData()
				if (!opt.build) {
					watcher.ee.on('done', postBuild)
				}
			})
		}
		tsc = cproc.spawn(process.argv0, tscArgs)
		const reBuildError = /^.+\(\d+,\d+\): error/,
			reBuildIndent = /^ {2}/,
			reBuildTimestamp = /^\d\d:\d\d:\d\d - /,
			reBuildComplete = /Watching for file changes.$/
		let buildErrors = false
		tsc.stdout.setEncoding('utf8')
			.on('data', data => {
				for (let line of data.split('\n')) {
					if (line.trim() === '') {
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
					startServer(false)
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
	return Promise.all([
		...dataFiles.concat.map(x => concatFiles(x)),
		...dataFiles.copy.map(x => copyFile(x)),
	]).then(() => {
		if (watcher) {
			watcher.ee.emit('done')
			watcher.timer = 0
		}
		printBuild('Data files built')
	}).catch(err => {
		printErrors(err.message)
		process.exit(1)
	})
}

function watchData() {
	watcher = {
		timer: 0,
		ee: new EventEmitter(),
	}
	const watch = dataFiles.copy.slice()
	for (const files of dataFiles.concat) {
		watch.push(...files.input)
	}
	for (const file of watch) {
		try {
			fs.watch(path.join(dataDir, file), () => {
				if (watcher.timer) {
					clearTimeout(watcher.timer)
				}
				watcher.timer = setTimeout(buildData, 200)
			})
		}
		catch (err) {
			printBuild(`Failed to watch ${file}`)
		}
	}
}

function concatFiles(fileGroup) {
	const promises = []
	for (const filePath of fileGroup.input) {
		promises.push(new Promise((resolve, reject) => {
			fs.readFile(path.join(dataDir, filePath), 'utf8', (err, content) => {
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
			const result = {}
			for (const input of inputs) {
				for (const key in input) {
					result[key] = input[key]
				}
			}
			fs.writeFile(path.join(outDir, fileGroup.output), JSON.stringify(result), 'utf8', (err) => {
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
		const rs = fs.createReadStream(path.join(dataDir, filePath)),
			ws = fs.createWriteStream(path.join(outDir, path.basename(filePath)))
		rs.on('error', reject)
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
		cwd: path.join(process.cwd(), outDir),
	})
	server.stdout.setEncoding('utf8').on('data', printServer)
	server.stderr.setEncoding('utf8').on('data', printErrors)
	server.on('exit', code => {
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
	process.exit(1)
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
				'	w	Watch for changes in source or data files\n',
			)
			process.exit()
	}
}

if (opt.data && !(fs.existsSync(path.join(dataDir, itemNames)) && fs.existsSync(path.join(dataDir, itemTypes)))) {
	console.log(
		'WARNING: itemnames.json or itemtypes.json is missing.\n' +
		'You probably want to put the following file in the folder "%s"\n' +
		'\n' +
		'	https://github.com/WFCD/warframe-worldstate-data/raw/master/data/languages.json\n' +
		'\n' +
		'and run the command\n' +
		'\n' +
		'	%s items\n',
		path.join(__dirname, dataDir),
		path.basename(process.argv0).replace(/\.exe$/, ''),
	)
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	rl.question('Continue anyway? [yN] ', (answer) => {
		if (answer.toLowerCase() === 'y') {
			for (const fileName of [itemNames, itemTypes]) {
				const filePath = path.join(dataDir, fileName)
				if (!fs.existsSync(filePath)) {
					fs.writeFileSync(filePath, '{}', 'utf8')
				}
			}
			build()
		}
		rl.close()
		process.stdin.destroy()
	})
}
else {
	build()
}
