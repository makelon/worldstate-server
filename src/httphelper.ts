import http = require('http')
import https = require('https')
import nodeUrl = require('url')
import config from './config'

/**
 * Create a reusable HTTP request options object for repeated requests to the same host
 *
 * @param url
 * @param method
 * @returns Request options object
 */
export function prepareRequest(url: string, method: string = 'GET'): https.RequestOptions {
	const wsUrlParsed = nodeUrl.parse(url),
		requestOptions: https.RequestOptions = {
			protocol: wsUrlParsed.protocol,
			hostname: wsUrlParsed.hostname,
			port: wsUrlParsed.port,
			method: method,
			path: wsUrlParsed.path,
			auth: wsUrlParsed.auth,
			headers: {
				'Accept-Encoding': 'gzip, deflate',
				'User-Agent': config.userAgent
			},
		timeout: config.requestTimeout
	}
	if (wsUrlParsed.protocol == 'https:') {
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
export function sendRequest(requestOptions: https.RequestOptions): http.ClientRequest {
	const req = requestOptions.protocol == 'https:'
		? https.request(requestOptions)
		: http.request(requestOptions)
	req.setTimeout(config.requestTimeout)
		.once('timeout', () => { req.abort() })
		.end()
	return req
}
