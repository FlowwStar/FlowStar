import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import React from 'react'

describe('Dialog', () => {
  describe('opening and closing via trigger', () => {
    it('opens dialog when trigger is activated', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>This is the dialog content</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument()
      fireEvent.click(screen.getByText('Open Dialog'))
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
      expect(screen.getByText('This is the dialog content')).toBeInTheDocument()
    })

    it('renders dialog trigger as button by default', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByRole('button', { name: 'Open Dialog' })).toBeInTheDocument()
    })
  })

  describe('showCloseButton prop', () => {
    it('accepts showCloseButton true prop', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent showCloseButton={true}>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open Dialog'))
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    it('accepts showCloseButton false prop', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open Dialog'))
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    it('defaults to showing close button when prop is not specified', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open Dialog'))
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })
  })

  describe('content rendering', () => {
    it('renders dialog title correctly', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open'))
      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('renders dialog description correctly', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogDescription>Test Description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open'))
      expect(screen.getByText('Test Description')).toBeInTheDocument()
    })

    it('renders all content including header and footer', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>My Dialog</DialogTitle>
              <DialogDescription>This is a description</DialogDescription>
            </DialogHeader>
            <div>Custom content here</div>
            <DialogFooter>
              <span>Footer content</span>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open Dialog'))
      expect(screen.getByText('My Dialog')).toBeInTheDocument()
      expect(screen.getByText('This is a description')).toBeInTheDocument()
      expect(screen.getByText('Custom content here')).toBeInTheDocument()
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })
  })

  describe('DialogTrigger asChild prop', () => {
    it('renders child element as trigger when asChild is true', () => {
      const { container } = render(
        <Dialog>
          <DialogTrigger asChild>
            <a href="/test">Custom Trigger</a>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const trigger = container.querySelector('a')
      expect(trigger).toBeInTheDocument()
      expect(trigger?.href).toContain('/test')
    })

    it('opens dialog when asChild trigger is activated', () => {
      const { container } = render(
        <Dialog>
          <DialogTrigger asChild>
            <a href="/test">Custom Trigger</a>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const trigger = container.querySelector('a')
      fireEvent.click(trigger!)
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })
  })

  describe('Escape key handling', () => {
    it('responds to Escape key press', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open Dialog'))
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    })
  })

  describe('Dialog structure components', () => {
    it('DialogHeader renders without errors', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open'))
      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    it('DialogFooter renders without errors', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
            <DialogFooter>
              <span>Footer</span>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open'))
      expect(screen.getByText('Footer')).toBeInTheDocument()
    })

    it('DialogFooter with showCloseButton true renders correctly', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
            <DialogFooter showCloseButton={true}>
              <span>Footer content</span>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      fireEvent.click(screen.getByText('Open'))
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })
  })
})
