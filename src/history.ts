/**
 * Create or update a volatile progress history record marked by a negative timestamp
 *
 * @param currentProgress Current progress
 * @param progressHistory Previous progress records
 * @param timestamp Current time
 */
export function update(currentProgress: number, progressHistory: WfProgressHistory, timestamp: number): void {
	const last = progressHistory[progressHistory.length - 1]
	if (last[0] < 0) {
		last[0] = -timestamp
		last[1] = currentProgress
	}
	else {
		progressHistory.push([-timestamp, currentProgress])
	}
}

/**
 * On large enough progress changes, create a new volatile progress record and mark the previous one as permanent
 *
 * @param progress Current progress
 * @param history Previous progress records
 * @param timestamp Current time
 * @param threshold Minimum change to trigger new record
 * @returns True if a new record was inserted
 */
export function checkpoint(progress: number, history: WfProgressHistory, timestamp: number, threshold: number): boolean {
	if (history.length < 2) {
		return false
	}
	const progressDiff = Math.abs(progress - history[history.length - 2][1])
	if (progressDiff >= threshold || progress <= 0) {
		history[history.length - 1][0] = timestamp
		return true
	}
	else {
		return false
	}
}

/**
 * Remove the last progress history record if it's temporary
 * and add a final record with the current timestamp
 *
 * @param progressHistory Previous progress records
 * @param timestamp Current time
 */
export function finalize(progressHistory: WfProgressHistory, timestamp: number): void {
	if (progressHistory[progressHistory.length - 1][0] < 0) {
		progressHistory.pop()
	}
	if (progressHistory[progressHistory.length - 1][1] > 0) {
		progressHistory.push([timestamp, 0])
	}
}
