import {jevConflictArbiter} from '../lib/providers/jev/index.ts'
import type {Conflict} from '../lib/agents/interfaces.ts'

const PURPOSE = 'Answer questions about how quantum computers work, including qubits, gates, algorithms, hardware and limitations.'

// The four real conflicts from kbt432byCXWQ, with the side Magnus chose.
const CASES: {conflict: Conflict; expected: number; label: string}[] = [
  {
    label: 'RSA factoring basis',
    expected: 1,
    conflict: {
      id: 'c1',
      issue: 'The algorithms entry claims encryption relies on the difficulty of factoring very large primes, but the source clarifies that encryption relies on multiplying very large primes to create a composite key, then making it hard to factor that composite number. Primes themselves cannot be nontrivially factored.',
      sides: [
        {claim: 'Modern encryption relies on the computational difficulty of factoring very large primes.', fromEntry: true},
        {claim: 'Much encryption relies on multiplying very large primes to create a secret key, which is hard for classical computers to undo.', fromEntry: false},
      ],
    },
  },
  {
    label: 'Photonic encoding',
    expected: 1,
    conflict: {
      id: 'c2',
      issue: 'The hardware entry lists polarization, wavelength, time of arrival and photon number as how photons encode information, but the misconceptions entry notes IBM says directional spin states while Azure lists polarization or phase.',
      sides: [
        {claim: 'Photons encode information via directional spin states (IBM) or polarization/phase (Azure).', fromEntry: true},
        {claim: 'Photons encode information via polarization, wavelength, time of arrival and photon number.', fromEntry: true},
      ],
    },
  },
  {
    label: 'Superconducting coherence',
    expected: 1,
    conflict: {
      id: 'c3',
      issue: 'The hardware entry states superconducting qubits have shorter coherence times than trapped-ion qubits, but the misconceptions entry reports IBM claiming superconducting qubits have relatively robust coherence, contradicting NIST.',
      sides: [
        {claim: 'Superconducting qubits have relatively robust coherence.', fromEntry: true},
        {claim: 'Superconducting qubits have shorter coherence times than trapped-ion qubits.', fromEntry: true},
      ],
    },
  },
  {
    label: "Shor's target",
    expected: 1,
    conflict: {
      id: 'c4',
      issue: "The algorithms entry states Shor's algorithm factors large numbers that are products of large primes, but the misconceptions entry notes IBM's text imprecisely refers to factoring a large prime number, which is mathematically incorrect.",
      sides: [
        {claim: "Shor's algorithm factors a large prime number.", fromEntry: true},
        {claim: "Shor's algorithm factors large numbers that are products of large primes.", fromEntry: true},
      ],
    },
  },
]

let agreed = 0
for (const {conflict, expected, label} of CASES) {
  const choice = await jevConflictArbiter.choose({purpose: PURPOSE, conflict})
  const verdict = !choice
    ? 'LEFT OPEN (below threshold)'
    : choice.side === expected
      ? `agrees  side ${choice.side} @ ${choice.score.toFixed(2)}`
      : `DISAGREES  picked ${choice.side} @ ${choice.score.toFixed(2)}, human said ${expected}`
  if (choice?.side === expected) agreed += 1
  console.log(`${label.padEnd(28)} ${verdict}`)
}
console.log(`\nagreed with the human decision on ${agreed} of ${CASES.length}`)
