import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiFailure } from './api'
import { keysSent, openTender, prepareHarness, resetHarness, sale, signIn, switchTo } from './app-test-harness'
describe('one stable key per confirmed checkout and return intent', () => {
  beforeEach(prepareHarness)
  afterEach(resetHarness)

  it('reuses the checkout key while the outcome is unconfirmed and shows awaiting confirmation', async () => {
    vi.mocked(api.createSale)
      .mockRejectedValueOnce(new ApiFailure('SERVER_ERROR', 500))
      .mockRejectedValueOnce(new ApiFailure('SERVICE_UNAVAILABLE', 503))
      .mockResolvedValueOnce({ sale, duplicate: true })
    const user = await signIn('cashier')
    await openTender(user)

    await user.click(screen.getByRole('button', { name: 'Complete sale' }))
    expect(await screen.findByText(/could not confirm whether this sale was recorded/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Confirm sale status' }))
    await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(2))
    await user.click(await screen.findByRole('button', { name: 'Confirm sale status' }))

    await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(3))
    const keys = keysSent(vi.mocked(api.createSale) as never)
    expect(new Set(keys).size).toBe(1)
    expect(await screen.findByText('Sale was already recorded. Duplicate request ignored.')).toBeTruthy()
  })

  it('replaces the checkout key and drops the awaiting state when the basket changes', async () => {
    vi.mocked(api.createSale).mockRejectedValueOnce(new ApiFailure('SERVER_ERROR', 500))
    const user = await signIn('cashier')
    await openTender(user)
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))
    await screen.findByText(/could not confirm whether this sale was recorded/)
    await user.click(screen.getByRole('button', { name: 'Back to basket' }))

    await user.click(screen.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' }))
    await user.click(screen.getByRole('button', { name: /Continue to tender/ }))
    await screen.findByRole('dialog', { name: 'Choose tender' })
    expect(screen.queryByText(/could not confirm whether this sale was recorded/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))

    await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(2))
    const keys = keysSent(vi.mocked(api.createSale) as never)
    expect(keys[1]).not.toBe(keys[0])
  })

  it('discards the checkout key after a confirmed sale', async () => {
    const user = await signIn('cashier')
    await openTender(user)
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: /^Checkout/ }))

    await openTender(user)
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))

    await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(2))
    const keys = keysSent(vi.mocked(api.createSale) as never)
    expect(keys[1]).not.toBe(keys[0])
  })

  it('treats a definitive rejection as not recorded, with no awaiting state and a fresh key', async () => {
    vi.mocked(api.createSale).mockRejectedValueOnce(new ApiFailure('INSUFFICIENT_STOCK', 409))
    const user = await signIn('cashier')
    await openTender(user)

    await user.click(screen.getByRole('button', { name: 'Complete sale' }))
    expect((await screen.findByRole('alert')).textContent).toContain('request could not be completed')
    expect(screen.queryByText(/could not confirm whether this sale was recorded/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))

    await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(2))
    const keys = keysSent(vi.mocked(api.createSale) as never)
    expect(keys[1]).not.toBe(keys[0])
  })

  it('discards an unconfirmed checkout key on sign-out', async () => {
    vi.mocked(api.createSale).mockRejectedValueOnce(new ApiFailure('SERVER_ERROR', 500))
    const user = await signIn('cashier')
    await openTender(user)
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))
    await screen.findByText(/could not confirm whether this sale was recorded/)
    await user.click(screen.getByRole('button', { name: 'Back to basket' }))

    await switchTo(user, 'cashier')
    await openTender(user)
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))

    await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(2))
    const keys = keysSent(vi.mocked(api.createSale) as never)
    expect(keys[1]).not.toBe(keys[0])
  })

  async function openReturn(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Sales & returns' }))
    await user.click(await screen.findByRole('button', { name: sale.receiptNumber }))
    await user.click(await screen.findByRole('button', { name: 'Record return' }))
    await user.type(await screen.findByRole('spinbutton', { name: 'Quantity of Daybreak Coffee Beans to return' }), '1')
  }

  it('reuses the return key while the outcome is unconfirmed', async () => {
    vi.mocked(api.returnSale)
      .mockRejectedValueOnce(new ApiFailure('SERVICE_UNAVAILABLE', 503))
      .mockResolvedValueOnce({
        return: { id: 'return-demo-01', saleId: sale.id, refundMinor: 1992, reason: 'customer_request' },
      })
    const user = await signIn('supervisor')
    await openReturn(user)

    await user.click(screen.getByRole('button', { name: 'Record simulated refund' }))
    expect((await screen.findByRole('alert')).textContent).toContain('request could not be completed')
    expect(screen.getByText(/could not confirm whether this return was recorded/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Confirm return status' }))

    await waitFor(() => expect(api.returnSale).toHaveBeenCalledTimes(2))
    const keys = vi.mocked(api.returnSale).mock.calls.map((call) => call[2])
    expect(keys[1]).toBe(keys[0])
    expect(await screen.findByText('Simulated refund $19.92 recorded.')).toBeTruthy()
  })

  it('discards the return key when the return form is abandoned', async () => {
    vi.mocked(api.returnSale).mockRejectedValueOnce(new ApiFailure('SERVICE_UNAVAILABLE', 503))
    const user = await signIn('supervisor')
    await openReturn(user)
    await user.click(screen.getByRole('button', { name: 'Record simulated refund' }))
    await screen.findByText(/could not confirm whether this return was recorded/)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(await screen.findByRole('button', { name: 'Record return' }))
    await user.type(await screen.findByRole('spinbutton', { name: 'Quantity of Daybreak Coffee Beans to return' }), '1')
    expect(screen.queryByText(/could not confirm whether this return was recorded/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Record simulated refund' }))

    await waitFor(() => expect(api.returnSale).toHaveBeenCalledTimes(2))
    const keys = vi.mocked(api.returnSale).mock.calls.map((call) => call[2])
    expect(keys[1]).not.toBe(keys[0])
  })

  it('does not repeat a recorded return when only the sale refresh fails', async () => {
    const user = await signIn('supervisor')
    await openReturn(user)
    vi.mocked(api.sale).mockRejectedValueOnce(new ApiFailure('SALE_UNAVAILABLE', 503))

    await user.click(screen.getByRole('button', { name: 'Record simulated refund' }))

    expect(await screen.findByText('Simulated refund $19.92 recorded.')).toBeTruthy()
    expect(api.returnSale).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Return items' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Record return' })).toBeNull()
  })
})
