import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'PHC Exchange - AI-Powered Medicine Redistribution',
  description: 'Prevent medicine stockouts and expiry waste by enabling AI-assisted lateral redistribution between nearby PHCs before triggering centralized replenishment.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen" style={{ background: '#030712', fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
