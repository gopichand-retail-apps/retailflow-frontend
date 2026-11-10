import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiFailure, type DemoRole } from '../api'
import { renderWithRetailContent, stubRetailContentModel } from '../test-utils'
import { LoginScreen } from './LoginScreen'

describe('LoginScreen', () => {
  beforeEach(stubRetailContentModel)
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('communicates role loading and role-service failure states', async () => {
    const loading = renderWithRetailContent(<LoginScreen onLogin={vi.fn()} roles={[]} rolesLoading rolesError={null} />)

    await screen.findByText('Choose a local test profile')
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true')

    loading.unmount()
    renderWithRetailContent(
      <LoginScreen onLogin={vi.fn()} roles={[]} rolesLoading={false} rolesError="Role service unavailable" />,
    )

    await screen.findByText('Choose a local test profile')
    expect(screen.getByRole('alert').textContent).toContain('Role service unavailable')
    expect(screen.queryByRole('button', { name: /Cashier/ })).toBeNull()
  })

  it('keeps sign-in disabled while pending and reports a rejected login safely', async () => {
    const user = userEvent.setup()
    let rejectLogin: (reason: unknown) => void = () => {}
    const onLogin = vi.fn(
      (_role: DemoRole) =>
        new Promise<void>((_resolve, reject) => {
          rejectLogin = reject
        }),
    )
    renderWithRetailContent(
      <LoginScreen onLogin={onLogin} roles={['cashier']} rolesLoading={false} rolesError={null} />,
    )

    await screen.findByText('Choose a local test profile')
    const cashierButton = screen.getByRole('button', { name: /Cashier/ })
    await user.click(cashierButton)
    expect(cashierButton).toHaveProperty('disabled', true)

    rejectLogin(new ApiFailure('UNKNOWN_FAILURE', 500))
    expect((await screen.findByRole('alert')).textContent).toContain('request could not be completed')
    expect(cashierButton).toHaveProperty('disabled', false)
    expect(onLogin).toHaveBeenCalledWith('cashier')
  })
})
