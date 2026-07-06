import { ImageResponse } from '@vercel/og'

export const runtime = 'edge'

interface OGParams {
  amount?: string
  symbol?: string
  recipient?: string
  sender?: string
  status?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const params: OGParams = {
      amount: searchParams.get('amount') || '0',
      symbol: searchParams.get('symbol') || 'XLM',
      recipient: searchParams.get('recipient') || '',
      sender: searchParams.get('sender') || '',
      status: searchParams.get('status') || 'active',
    }

    const shortenAddress = (addr: string) => {
      if (!addr) return ''
      return addr.slice(0, 6) + '...' + addr.slice(-4)
    }

    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 48,
            background: 'linear-gradient(135deg, #0c1014 0%, #1a202c 100%)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: 'white',
            padding: '40px',
          }}
        >
          {/* Logo / Header */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              marginBottom: 40,
              background: 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            FlowStar
          </div>

          {/* Main Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            {/* Amount */}
            <div
              style={{
                fontSize: 56,
                fontWeight: 'bold',
                color: '#60a5fa',
              }}
            >
              {params.amount} {params.symbol}
            </div>

            {/* Status Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 24px',
                borderRadius: 24,
                background: params.status === 'active' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                border: `2px solid ${params.status === 'active' ? '#60a5fa' : '#6b7280'}`,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: params.status === 'active' ? '#60a5fa' : '#6b7280',
                }}
              />
              <span style={{ fontSize: 24, textTransform: 'capitalize' }}>
                {params.status}
              </span>
            </div>

            {/* Addresses */}
            <div
              style={{
                display: 'flex',
                gap: 32,
                justifyContent: 'center',
                fontSize: 20,
                color: '#9ca3af',
                width: '100%',
                flexWrap: 'wrap',
              }}
            >
              {params.sender && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 16, color: '#6b7280' }}>From</span>
                  <span style={{ fontFamily: 'monospace', color: '#e5e7eb' }}>
                    {shortenAddress(params.sender)}
                  </span>
                </div>
              )}
              {params.recipient && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 16, color: '#6b7280' }}>To</span>
                  <span style={{ fontFamily: 'monospace', color: '#e5e7eb' }}>
                    {shortenAddress(params.recipient)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: 60,
              fontSize: 20,
              color: '#6b7280',
            }}
          >
            Stream tokens by the second on Stellar
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (error) {
    console.error('OG image generation error:', error)
    return new Response('Failed to generate OG image', { status: 500 })
  }
}
