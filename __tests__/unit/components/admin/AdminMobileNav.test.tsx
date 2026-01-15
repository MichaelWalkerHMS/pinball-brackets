import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminMobileNav from '@/components/admin/AdminMobileNav'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: { children: React.ReactNode; href: string; onClick?: () => void; [key: string]: unknown }) => (
    <a href={href} onClick={onClick} {...props}>{children}</a>
  ),
}))

describe('AdminMobileNav', () => {
  it('renders hamburger menu button', () => {
    render(<AdminMobileNav />)

    const menuButton = screen.getByRole('button', { name: 'Menu' })
    expect(menuButton).toBeInTheDocument()
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens menu when hamburger is clicked', async () => {
    const user = userEvent.setup()
    render(<AdminMobileNav />)

    const menuButton = screen.getByRole('button', { name: 'Menu' })
    await user.click(menuButton)

    // Menu should be visible
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('displays all navigation links when open', async () => {
    const user = userEvent.setup()
    render(<AdminMobileNav />)

    await user.click(screen.getByRole('button', { name: 'Menu' }))

    // Check all navigation links are present
    expect(screen.getByRole('menuitem', { name: 'Tournaments' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Content' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'View Site' })).toBeInTheDocument()
  })

  it('has correct hrefs for navigation links', async () => {
    const user = userEvent.setup()
    render(<AdminMobileNav />)

    await user.click(screen.getByRole('button', { name: 'Menu' }))

    expect(screen.getByRole('menuitem', { name: 'Tournaments' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('menuitem', { name: 'Content' })).toHaveAttribute('href', '/admin/content')
    expect(screen.getByRole('menuitem', { name: 'Feedback' })).toHaveAttribute('href', '/admin/feedback')
    expect(screen.getByRole('menuitem', { name: 'View Site' })).toHaveAttribute('href', '/')
  })

  it('closes menu when hamburger is clicked again', async () => {
    const user = userEvent.setup()
    render(<AdminMobileNav />)

    const menuButton = screen.getByRole('button', { name: 'Menu' })

    // Open menu
    await user.click(menuButton)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Close menu
    await user.click(menuButton)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes menu when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<AdminMobileNav />)

    // Open menu
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Press Escape
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('closes menu when clicking outside', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <div>
        <div data-testid="outside">Outside content</div>
        <AdminMobileNav />
      </div>
    )

    // Open menu
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'))

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('closes menu when a navigation link is clicked', async () => {
    const user = userEvent.setup()
    render(<AdminMobileNav />)

    // Open menu
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click a navigation link
    await user.click(screen.getByRole('menuitem', { name: 'Tournaments' }))

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('focuses first link when menu opens', async () => {
    const user = userEvent.setup()
    render(<AdminMobileNav />)

    await user.click(screen.getByRole('button', { name: 'Menu' }))

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Tournaments' })).toHaveFocus()
    })
  })
})
