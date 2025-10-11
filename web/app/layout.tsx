import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rectangles Editor',
  description: 'Real-time collaborative graphic editing tool built with Yjs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

