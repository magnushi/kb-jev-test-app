import Link from 'next/link'

export function Header({count, onList}: {count: number; onList: 'list' | 'lab'}) {
  return (
    <header className="header">
      <Link href="/" className="wordmark">
        <span className="dotmark" aria-hidden>
          {Array.from({length: 9}, (_, i) => (
            <i key={i} />
          ))}
        </span>
        Knowledge Base Lab
      </Link>
      {onList === 'list' ? (
        <Link href="/knowledge-bases" className="btn">
          All knowledge bases <span className="mono muted">{count}</span>
        </Link>
      ) : (
        <Link href="/" className="btn">
          Back to Lab
        </Link>
      )}
    </header>
  )
}
