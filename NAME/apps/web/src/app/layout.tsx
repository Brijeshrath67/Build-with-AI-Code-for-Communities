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
      <body
        className="min-h-screen"
        style={{
          background: '#030712',
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  )
}
