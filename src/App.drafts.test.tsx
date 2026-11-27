import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type SaleDetail } from './api'
import {
  cashierOwner,
  legacyDraft,
  openTender,
  ownedDraft,
  prepareHarness,
  resetHarness,
  sale,
  seedQueue,
  setOnline,
  signIn,
  storedQueue,
  STORAGE_KEY,
  switchTo,
} from './app-test-harness'
describe('draft ownership on a shared register', () => {
  beforeEach(prepareHarness)
  afterEach(resetHarness)

  it('saves the signed-in operator as the draft owner and says it is saved on this register', async () => {
    setOnline(false)
    const user = await signIn('cashier')

    await openTender(user)
    await user.click(screen.getByRole('button', { name: 'Save cash draft' }))

    expect(
      await screen.findByText('Draft saved on this register. It is not a sale until the server confirms.'),
    ).toBeTruthy()
    expect(screen.getByText('1 offline cash draft')).toBeTruthy()
    expect(
      screen.getByText('Draft saved on this register. Not completed until the server confirms the sync.'),
    ).toBeTruthy()
    expect(storedQueue()).toHaveLength(1)
    expect(storedQueue()[0]).toMatchObject({ owner: cashierOwner })
  })

  it('does not show or submit one operator draft to a second operator, then syncs it for its owner', async () => {
    seedQueue([ownedDraft])
    const user = await signIn('supervisor')

    expect(screen.queryByText('1 offline cash draft')).toBeNull()
    expect(screen.queryByText(/needs review/)).toBeNull()
    expect(api.createSale).not.toHaveBeenCalled()
    expect(storedQueue()).toHaveLength(1)

    await switchTo(user, 'cashier')

    expect(await screen.findByText('Offline cash sale RF-20261030-TEST0001 synced.')).toBeTruthy()
    expect(api.createSale).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.createSale).mock.calls[0]?.[1]).toBe('offline-checkout-owned')
    await waitFor(() => expect(storedQueue()).toEqual([]))
  })

  it('does not submit a draft saved in another store', async () => {
    seedQueue([{ ...ownedDraft, owner: { storeId: 'store-demo-02', userId: 'user-cashier-01' } }])
    await signIn('cashier')

    expect(screen.queryByText('1 offline cash draft')).toBeNull()
    expect(api.createSale).not.toHaveBeenCalled()
    expect(storedQueue()).toHaveLength(1)
  })

  it('keeps a draft with no recorded owner for supervisor review and never submits it', async () => {
    seedQueue([legacyDraft])
    const user = await signIn('cashier')

    expect(screen.queryByText(/needs review/)).toBeNull()
    expect(screen.queryByText('1 offline cash draft')).toBeNull()

    await switchTo(user, 'supervisor')
    await user.click(await screen.findByText('1 draft on this register needs review'))

    expect(screen.getByText('Owner unknown')).toBeTruthy()
    expect(screen.getByText(/1 item · \$19\.92/)).toBeTruthy()
    expect(
      screen.getByText('These drafts stay on this register. They are never submitted or deleted automatically.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /sync|submit|delete|remove|clear/i })).toBeNull()
    expect(api.createSale).not.toHaveBeenCalled()
    expect(storedQueue()).toEqual([legacyDraft])
  })

  it('keeps unreadable draft data and lists it for review instead of discarding it', async () => {
    localStorage.setItem(STORAGE_KEY, '{ broken draft data')
    const user = await signIn('supervisor')

    await user.click(await screen.findByText('1 draft on this register needs review'))

    expect(screen.getByText('Unreadable entry kept as found')).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toContain('{ broken draft data')
  })

  it('sets aside the operator own drafts for supervisor review without deleting them', async () => {
    setOnline(false)
    const user = await signIn('cashier')
    await openTender(user)
    await user.click(screen.getByRole('button', { name: 'Save cash draft' }))
    expect(await screen.findByText('1 offline cash draft')).toBeTruthy()

    const confirm = vi.spyOn(window, 'confirm')
    confirm.mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Set aside' }))
    expect(screen.getByText('1 offline cash draft')).toBeTruthy()
    expect(storedQueue()[0]).not.toHaveProperty('setAside')

    await user.click(screen.getByRole('button', { name: 'Set aside' }))
    await waitFor(() => expect(screen.queryByText('1 offline cash draft')).toBeNull())
    expect(screen.getByText('Drafts set aside for supervisor review. Nothing was deleted.')).toBeTruthy()
    expect(storedQueue()).toHaveLength(1)
    expect(storedQueue()[0]).toMatchObject({ owner: cashierOwner, setAside: true })

    await switchTo(user, 'supervisor')
    await user.click(await screen.findByText('1 draft on this register needs review'))
    expect(screen.getByText('Set aside by its operator')).toBeTruthy()
  })

  it('shows awaiting confirmation while a saved draft is being synced', async () => {
    seedQueue([ownedDraft])
    let finish: (value: { sale: SaleDetail; duplicate: boolean }) => void = () => {}
    vi.mocked(api.createSale).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await signIn('cashier')

    expect(await screen.findByText('Awaiting confirmation from the server…')).toBeTruthy()
    finish({ sale, duplicate: false })

    await waitFor(() => expect(screen.queryByText('1 offline cash draft')).toBeNull())
  })

  it('keeps a draft another tab saved on this register when this tab saves its own', async () => {
    setOnline(false)
    const user = await signIn('cashier')
    localStorage.setItem(STORAGE_KEY, JSON.stringify([legacyDraft]))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))

    await openTender(user)
    await user.click(screen.getByRole('button', { name: 'Save cash draft' }))

    expect(await screen.findByText('1 offline cash draft')).toBeTruthy()
    await waitFor(() => expect(storedQueue()).toHaveLength(2))
    expect(storedQueue()[0]).toEqual(legacyDraft)
    expect(storedQueue()[1]).toMatchObject({ owner: cashierOwner })
  })
})
