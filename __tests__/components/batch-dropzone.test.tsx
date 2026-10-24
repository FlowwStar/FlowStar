import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BatchCreatePage from '@/app/app/create/batch/page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/layout/require-wallet', () => ({
  RequireWallet: ({ children }: any) => <div data-testid="require-wallet">{children}</div>,
}))

vi.mock('@/hooks/use-contract', () => ({
  useContract: () => ({
    createStreamsBatch: vi.fn(),
    pending: false,
    error: null,
  }),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => ({
    config: {
      knownTokens: [
        { address: 'CTOKEN1', symbol: 'XLM', decimals: 7 },
        { address: 'CTOKEN2', symbol: 'USDC', decimals: 7 },
      ],
    },
  }),
}))

describe('BatchCreatePage CSV Drag & Drop', () => {
  it('renders dropzone with initial prompt and supports text', () => {
    render(<BatchCreatePage />)
    const dropzone = screen.getByTestId('csv-dropzone')
    expect(dropzone).toBeInTheDocument()
    expect(screen.getByText('Drag & drop your CSV here, or click to browse')).toBeInTheDocument()
    expect(screen.getByText('Supports: .csv (max 500 rows)')).toBeInTheDocument()
  })

  it('updates visual feedback on dragEnter and dragLeave', () => {
    render(<BatchCreatePage />)
    const dropzone = screen.getByTestId('csv-dropzone')

    fireEvent.dragEnter(dropzone)
    expect(screen.getByText('Drop your CSV file here')).toBeInTheDocument()

    fireEvent.dragLeave(dropzone)
    expect(screen.getByText('Drag & drop your CSV here, or click to browse')).toBeInTheDocument()
  })

  it('shows error message when dropped file is not a .csv', async () => {
    render(<BatchCreatePage />)
    const dropzone = screen.getByTestId('csv-dropzone')

    const nonCsvFile = new File(['hello,world'], 'test.txt', { type: 'text/plain' })

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [nonCsvFile],
      },
    })

    await waitFor(() => {
      expect(screen.getByText('Please upload a .csv file.')).toBeInTheDocument()
    })
  })

  it('parses valid CSV file on drop and displays parsed row preview', async () => {
    render(<BatchCreatePage />)
    const dropzone = screen.getByTestId('csv-dropzone')

    const csvContent =
      'recipient,amount,start_time,end_time,cliff_time,cliff_amount\n' +
      'GA2C5RFPE6GCKMY3US5HHS6TDGNOQCHOK2XZJGSBCUC27WXP5SYQELTG,100,1700000000,1700010000,1700005000,25'
    const csvFile = new File([csvContent], 'valid_batch.csv', { type: 'text/csv' })
    Object.defineProperty(csvFile, 'text', {
      value: async () => csvContent,
      configurable: true,
    })

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [csvFile],
      },
    })

    await waitFor(() => {
      expect(
        screen.getByText('GA2C5RFPE6GCKMY3US5HHS6TDGNOQCHOK2XZJGSBCUC27WXP5SYQELTG')
      ).toBeInTheDocument()
    })
  })

  it('triggers hidden input click when dropzone is clicked', () => {
    render(<BatchCreatePage />)
    const fileInput = document.getElementById('csvFile') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const dropzone = screen.getByTestId('csv-dropzone')
    fireEvent.click(dropzone)

    expect(clickSpy).toHaveBeenCalled()
  })
})
