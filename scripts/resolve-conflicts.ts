import {createClient} from '@sanity/client'
import {config} from '../lib/config.ts'

/**
 * Magnus's decisions on the four conflicts in kbt432byCXWQ, 30 September 2026.
 * Each becomes a standing instruction for every future build, so the reasoning
 * is recorded here, not only in the resolution.
 *
 * `resolution` is an INDEX into the issue's `content.sides` array. The client's
 * type says 'keep_existing' | 'accept_new' and the server rejects both.
 */
const DECISIONS = [
  {
    id: 'issue.1VBRQYC70HCYHJAJKZ506KYA20',
    side: 1,
    picked: 'multiplying very large primes (and then factoring the product)',
    why: 'Real error. "Factoring large primes" is meaningless; RSA factors the composite p*q. Matches Sanity\'s own suggested side.',
  },
  {
    id: 'issue.HWHC8M184WW1NDMKJ85VDAC3CG',
    side: 1,
    picked: 'polarization, wavelength, time of arrival, photon number',
    why: 'Entry-vs-entry. The hardware entry\'s list is fuller and accurate; IBM\'s "directional spin states" is loose phrasing for polarization.',
  },
  {
    id: 'issue.RKAGKNB4MM686NJB21QK205474',
    side: 1,
    picked: 'shorter than trapped ion',
    why: 'Trapped-ion coherence exceeds superconducting by orders of magnitude. IBM\'s "robust" is framing, not an ordering claim.',
  },
  {
    id: 'issue.XDC0WA29QZ24168BXV0FFVTC44',
    side: 1,
    picked: 'products of primes',
    why: 'False positive. Both entries agree; misconceptions was documenting IBM\'s imprecision.',
  },
]

const kbId = 'kbt432byCXWQ'
const kb = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false,
  useProjectHostname: false,
  resource: {type: 'knowledge-base', id: kbId},
  context: {organizationId: config.sanity.organizationId},
})

// Verify each index still points at the claim we meant before writing policy.
const open = (await kb.context.issues.list({status: 'open'})) as any[]
for (const d of DECISIONS) {
  const issue = open.find((i) => i._id === d.id)
  if (!issue) {
    console.log(`SKIP   ${d.id} — no longer open`)
    continue
  }
  const side = issue.content?.sides?.[d.side]
  const value = String(side?.value ?? side?.claim ?? '')
  if (!value.startsWith(d.picked.slice(0, 24))) {
    console.log(`ABORT  ${d.id} — side ${d.side} is "${value.slice(0, 60)}", expected "${d.picked.slice(0, 40)}"`)
    continue
  }
  try {
    const res = await (kb.context.issues.resolve as unknown as (p: {
      issueId: string
      resolution: number
    }) => Promise<{jobId?: string}>)({issueId: d.id, resolution: d.side})
    console.log(`OK     ${d.id}  → "${d.picked.slice(0, 48)}"  ${res.jobId ? `job ${res.jobId}` : ''}`)
  } catch (error) {
    const e = error as {statusCode?: number; message?: string}
    console.log(`FAILED ${d.id}  ${e.statusCode ?? ''} ${String(e.message).slice(0, 110)}`)
  }
}

const left = await kb.context.issues.list({status: 'open'})
console.log(`\nopen issues remaining: ${left.length}`)
