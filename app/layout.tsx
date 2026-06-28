import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { NetworkProvider } from '@/components/providers/network-provider'
import { WalletProvider } from '@/components/providers/wallet-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// JSON-LD structured data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'FlowStar',
  description: 'Stream tokens by the second with cliffs and cancellations on Stellar Soroban',
  url: 'https://flowstar.app',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'FlowStar',
  },
}

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'FlowStar — Real-Time Token Streaming on Stellar',
    template: '%s | FlowStar',
  },
  description:
    'Stream tokens by the second with cliffs and cancellations on Stellar Soroban. Create vesting schedules, payroll, and grants that unlock continuously — withdraw anytime, cancel anytime.',
  keywords: ['stellar', 'soroban', 'token streaming', 'DeFi', 'payment streams', 'vesting', 'payroll', 'grants'],
  metadataBase: new URL('https://flowstar.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'FlowStar',
    title: 'FlowStar — Real-Time Token Streaming on Stellar',
    description:
      'Stream tokens by the second with cliffs and cancellations on Stellar Soroban. Create vesting schedules, payroll, and grants that unlock continuously — withdraw anytime, cancel anytime.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'FlowStar' }],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlowStar — Real-Time Token Streaming on Stellar',
    description:
      'Stream tokens by the second with cliffs and cancellations on Stellar Soroban. Create vesting schedules, payroll, and grants that unlock continuously — withdraw anytime, cancel anytime.',
    images: ['/og-image.png'],
    creator: '@flowstar',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NetworkProvider>
            <WalletProvider>
              {children}
              <Toaster position="top-right" />
            </WalletProvider>
          </NetworkProvider>
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
