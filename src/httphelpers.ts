import { type ClientRequest, type IncomingMessage, request as httpRequest } from 'http'
import { type RequestOptions, request as httpsRequest } from 'https'
import { createGunzip, createInflate } from 'zlib'

import config from './config.js'

/**
 * Create a reusable HTTP request options object for repeated requests to the same host
 *
 * @param url
 * @param method
 * @returns Request options object
 */
export function prepareRequest(url: string, method = 'GET'): RequestOptions {
	const urlParsed = new URL(url),
		requestOptions: RequestOptions = {
			protocol: urlParsed.protocol,
			hostname: urlParsed.hostname,
			port: urlParsed.port,
			method: method,
			path: urlParsed.pathname,
			headers: {
				'Accept-Encoding': 'gzip, deflate',
				'User-Agent': config.userAgent,
			},
			timeout: config.requestTimeout,
		}
	if (urlParsed.username) {
		requestOptions.auth = urlParsed.username + (urlParsed.password ? ':' + urlParsed.password : '')
	}
	if (urlParsed.protocol === 'https:') {
		if (!config.tlsVerify) {
			requestOptions.rejectUnauthorized = false
		}
		else if (config.tlsCa) {
			requestOptions.ca = config.tlsCa
		}
	}
	return requestOptions
}

/**
 * Send a HTTP(S) request
 *
 * @param requestOptions
 * @returns HTTP request object
 */
export function sendRequest(requestOptions: RequestOptions): ClientRequest {
	const req = requestOptions.protocol === 'https:'
		? httpsRequest(requestOptions)
		: httpRequest(requestOptions)
	req.setTimeout(config.requestTimeout)
		.once('timeout', () => { req.abort() })
		.end()
	return req
}

export function getResponseData(res: IncomingMessage): Promise<string> {
	let decomp,
		resData = ''
	switch (res.headers['content-encoding']) {
		case 'gzip':
			decomp = createGunzip()
			break
		case 'deflate':
			decomp = createInflate()
			break
	}
	const resStream = decomp ? res.pipe(decomp) : res
	resStream.setEncoding('utf8')

	return new Promise<string>((resolve, reject) => {
		resStream.on('error', reject)
			.on('data', (data: string) => { resData += data })
			.on('end', () => {
				if (res.statusCode !== 200) {
					reject(new Error(`HTTP error ${res.statusCode}: ${resData}`))
					return
				}
				resolve(resData)
			})
	})
}
