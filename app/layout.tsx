import type { Metadata } from 'next'
import { JetBrains_Mono, Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GIS Ndërtim',
  description: 'Sistem GIS për menaxhimin e kantiereve të ndërtimit',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className={`${outfit.variable} ${mono.variable}`}>
      <body className="h-full bg-bg text-txt font-sans antialiased">{children}</body>
    </html>
  )
}
