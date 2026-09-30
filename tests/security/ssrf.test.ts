import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assertPublicUrl} from '../../lib/ingestion/fetch.ts'

/** This guards a public, unauthenticated endpoint. Anything that gets past it
 *  can reach the internal network from our server. */

async function rejects(url: string, because: string): Promise<void> {
  await assert.rejects(
    () => assertPublicUrl(url),
    (error: unknown) => error instanceof Error,
    `${url} should be blocked (${because})`,
  )
}

test('blocks non-http protocols', async () => {
  for (const url of [
    'file:///etc/passwd',
    'gopher://example.com/',
    'ftp://example.com/x',
    'data:text/html,<script>alert(1)</script>',
    'javascript:alert(1)',
  ]) {
    await rejects(url, 'protocol not in the allowlist')
  }
})

test('blocks single-label hosts, which resolve on internal networks', async () => {
  for (const url of ['http://localhost/', 'http://localhost:8080/admin', 'http://intranet/']) {
    await rejects(url, 'no dot in hostname')
  }
})

test('blocks loopback, private and link-local addresses', async () => {
  for (const url of [
    'http://127.0.0.1/',
    'http://127.1.2.3/',
    'http://10.0.0.1/',
    'http://172.16.0.1/',
    'http://172.31.255.254/',
    'http://192.168.1.1/',
    'http://0.0.0.0/',
  ]) {
    await rejects(url, 'private or loopback range')
  }
})

test('blocks cloud metadata endpoints', async () => {
  // 169.254.169.254 is the classic SSRF target: it serves instance credentials.
  await rejects('http://169.254.169.254/latest/meta-data/', 'link-local metadata service')
})

test('blocks the carrier-grade NAT range', async () => {
  await rejects('http://100.64.0.1/', '100.64/10 is not public')
  await rejects('http://100.127.255.255/', '100.64/10 is not public')
})

test('blocks IPv6 loopback and unique-local addresses', async () => {
  for (const url of ['http://[::1]/', 'http://[fc00::1]/', 'http://[fd12:3456::1]/', 'http://[fe80::1]/']) {
    await rejects(url, 'IPv6 private range')
  }
})

test('blocks malformed input', async () => {
  for (const url of ['', 'not a url', '//example.com', 'http://']) {
    await rejects(url, 'unparseable')
  }
})

test('allows a public https URL', async () => {
  const url = await assertPublicUrl('https://example.com/docs')
  assert.equal(url.hostname, 'example.com')
  assert.equal(url.protocol, 'https:')
})

test('allows a public http URL', async () => {
  const url = await assertPublicUrl('http://example.com/')
  assert.equal(url.hostname, 'example.com')
})

test('a hostname that resolves to a private address is blocked', async () => {
  // localtest.me and similar resolve to 127.0.0.1 in public DNS, so protocol and
  // hostname checks alone are not enough — resolution has to be checked too.
  await rejects('http://localtest.me/', 'public name resolving to loopback')
})
