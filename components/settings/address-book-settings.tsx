'use client'

import { useEffect, useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getAddressBookEntries,
  updateAddressBookEntry,
  deleteAddressBookEntry,
  type AddressBookEntry,
} from '@/lib/address-book'
import { settingsCopy } from '@/lib/copy/settings'

export function AddressBookSettings() {
  const [entries, setEntries] = useState<AddressBookEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    setEntries(getAddressBookEntries())
  }, [])

  function startEdit(entry: AddressBookEntry) {
    setEditingId(entry.id)
    setEditLabel(entry.label)
  }

  function saveEdit(id: string) {
    const label = editLabel.trim()
    if (!label) {
      toast.error(settingsCopy.addressBook.validation.emptyLabel)
      return
    }
    updateAddressBookEntry(id, { label })
    setEntries(getAddressBookEntries())
    setEditingId(null)
    toast.success(settingsCopy.addressBook.toasts.entryUpdated)
  }

  function handleDelete(id: string) {
    deleteAddressBookEntry(id)
    setEntries(getAddressBookEntries())
    setConfirmingDeleteId(null)
    toast.success(settingsCopy.addressBook.toasts.entryRemoved)
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{settingsCopy.addressBook.emptyState}</p>
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0 flex-1">
            {editingId === entry.id ? (
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(entry.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
                className="h-8"
              />
            ) : (
              <p className="truncate text-sm font-medium">{entry.label}</p>
            )}
            <p className="truncate text-xs text-muted-foreground font-mono mt-0.5">
              {entry.federationAddress ?? entry.address}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {editingId === entry.id ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={settingsCopy.addressBook.saveAria}
                  onClick={() => saveEdit(entry.id)}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={settingsCopy.addressBook.cancelAria}
                  onClick={() => setEditingId(null)}
                >
                  <X className="size-4" />
                </Button>
              </>
            ) : confirmingDeleteId === entry.id ? (
              <>
                <span className="text-xs text-muted-foreground mr-1">
                  {settingsCopy.addressBook.confirmRemoveLabel}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => handleDelete(entry.id)}
                >
                  {settingsCopy.addressBook.confirmButton}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setConfirmingDeleteId(null)}
                >
                  {settingsCopy.addressBook.cancelButton}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={settingsCopy.addressBook.editAria}
                  onClick={() => startEdit(entry)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  aria-label={settingsCopy.addressBook.deleteAria}
                  onClick={() => setConfirmingDeleteId(entry.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
