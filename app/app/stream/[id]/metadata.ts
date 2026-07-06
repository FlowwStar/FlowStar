import { Metadata } from 'next'
import { getStream } from '@/lib/contract'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  try {
    const { id } = await params
    const stream = await getStream(id)

    if (!stream) {
      return {
        title: 'Stream not found | FlowStar',
        description: 'This stream may not exist or may have expired.',
      }
    }

    const ogImageUrl = new URL('/api/og', 'https://flowstar.app')
    ogImageUrl.searchParams.append('amount', (stream.depositedAmount / 10n ** BigInt(stream.token.decimals)).toString())
    ogImageUrl.searchParams.append('symbol', stream.token.symbol)
    ogImageUrl.searchParams.append('recipient', stream.recipient)
    ogImageUrl.searchParams.append('sender', stream.sender)
    ogImageUrl.searchParams.append('status', stream.cancelled ? 'cancelled' : 'active')

    const shortenAddress = (addr: string) => addr.slice(0, 6) + '...' + addr.slice(-4)
    const amount = (stream.depositedAmount / 10n ** BigInt(stream.token.decimals)).toString()
    const description = `${amount} ${stream.token.symbol} streaming to ${shortenAddress(stream.recipient)}`

    return {
      title: `Stream #${stream.id} | FlowStar`,
      description,
      metadataBase: new URL('https://flowstar.app'),
      openGraph: {
        type: 'website',
        siteName: 'FlowStar',
        title: `Stream #${stream.id} | FlowStar`,
        description,
        images: [
          {
            url: ogImageUrl.toString(),
            width: 1200,
            height: 630,
            alt: `FlowStar stream #${stream.id}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Stream #${stream.id} | FlowStar`,
        description,
        images: [ogImageUrl.toString()],
      },
    }
  } catch (error) {
    console.error('Failed to generate metadata:', error)
    return {
      title: 'Stream | FlowStar',
      description: 'Stream tokens by the second on Stellar',
    }
  }
}
