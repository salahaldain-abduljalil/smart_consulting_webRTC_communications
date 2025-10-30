#!/usr/bin/env node
// Minimal smoke test: GET base URL and check for the React meeting mount point
// Usage: node smokeTest.js [baseUrl]

const { URL } = require('url')
const http = require('http')
const https = require('https')

const base = process.argv[2] || 'http://127.0.0.1:8000'
let parsed
try {
  parsed = new URL(base)
} catch (e) {
  console.error('Invalid URL:', base)
  process.exit(2)
}

const lib = parsed.protocol === 'https:' ? https : http
const opts = {
  hostname: parsed.hostname,
  port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
  path: parsed.pathname || '/',
  method: 'GET',
  timeout: 5000,
}

function getRoot() {
  return new Promise((resolve, reject) => {
    const req = lib.request(opts, (res) => {
      const { statusCode } = res
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => resolve({ statusCode, body }))
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.end()
  })
}

;(async () => {
  console.log('Smoke test: checking', base)
  try {
    const r = await getRoot()
    if (r.statusCode !== 200) {
      console.error('FAIL: root returned status', r.statusCode)
      process.exit(3)
    }
    const body = r.body || ''
    if (!body.includes('id="react-meeting"') && !body.includes('react-meeting')) {
      console.error('FAIL: page does not contain react-meeting mount point')
      process.exit(4)
    }

    console.log('PASS: root reachable and meeting mount point found')
    process.exit(0)
  } catch (err) {
    console.error('FAIL: request error', err && err.message)
    process.exit(5)
  }
})()
