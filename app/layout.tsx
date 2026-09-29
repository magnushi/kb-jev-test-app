import type {Metadata} from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Knowledge Base Lab',
  description:
    'Turn a topic or a few public URLs into a real Sanity Knowledge Base, watch Jev filter the source material, then test it with an agent.',
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
