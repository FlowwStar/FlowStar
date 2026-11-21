import type { Preview } from '@storybook/react'
import { sb } from 'storybook/test'
import '../app/globals.css'

// Module mocks for hooks that talk to wallets / RPC. Stories override the
// return values per state via `mocked(hook).mockReturnValue(...)`.
sb.mock(import('../hooks/use-wallet.ts'), { spy: true })
sb.mock(import('../hooks/use-stream-history.ts'), { spy: true })
// Spy on app hooks/helpers so stories can stub wallet, network and Horizon
// responses via `mocked(...)` without touching real providers or the network.
sb.mock(import('../hooks/use-wallet'), { spy: true })
sb.mock(import('../components/providers/network-provider'), { spy: true })
sb.mock(import('../lib/stellar'), { spy: true })

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
