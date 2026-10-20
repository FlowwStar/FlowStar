import type { Meta, StoryObj } from '@storybook/react'
import { AddressBookSettings } from './address-book-settings'

const meta = {
  title: 'Settings/AddressBookSettings',
  component: AddressBookSettings,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AddressBookSettings>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyBook: Story = {
  beforeEach: () => {
    localStorage.removeItem('address_book')
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}

export const BookWithEntries: Story = {
  beforeEach: () => {
    const addressBook = [
      {
        id: 'addr_1',
        name: 'Alice Johnson',
        address: 'GDZST3XVCDTUJ76ZAV2HA72KYUW4DKOWLQ4BVE32YQRGEAIFUQ2YCQY',
        label: 'Primary Recipient',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'addr_2',
        name: 'Bob Smith',
        address: 'GBQT74NWN7KHZK5VPVL2YQHQIRLSVS3ATVUQRXE2BXVMQUQMVKTM5HSQ',
        label: 'Company Account',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'addr_3',
        name: 'Carol Lee',
        address: 'GAOK5WSI7U3DKPWYULJEZGMFS5ZCJQPGQXE5MGRFVE52QOBVVBRKQW23',
        label: 'Vault Account',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'addr_4',
        name: 'David Chen',
        address: 'GCSK5XT5ADFLBV7VJXVJTHZ3AKGFGAVDPVH3POYBNSPVWVVPNQVGJBQY',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
    localStorage.setItem('address_book', JSON.stringify(addressBook))
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}
