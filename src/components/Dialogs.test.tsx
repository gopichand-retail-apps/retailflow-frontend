import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaleDetail } from '../api'
import { renderWithRetailContent, stubNativeDialogs, stubRetailContentModel } from '../test-utils'
import { CheckoutDialog, ReceiptDialog, ReturnDialog } from './Dialogs'

const sale: SaleDetail = {
  id: 'sale-demo-01',
  cashierId: 'user-cashier-01',
  storeId: 'store-demo-01',
  receiptNumber: 'RF-20261030-TEST0001',
  status: 'completed',
  subtotalMinor: 1840,
  discountMinor: 0,
  taxMinor: 152,
  totalMinor: 1992,
  currency: 'USD',
  createdAt: '2026-10-30T12:00:00.000Z',
  lines: [
    {
      id: 'sale-line-01',
      productId: 'product-coffee-beans',
      sku: 'PAN-2041',
      name: 'Daybreak Coffee Beans',
      unitPriceMinor: 1840,
      quantity: 1,
      subtotalMinor: 1840,
      discountMinor: 0,
      taxMinor: 152,
      totalMinor: 1992,
      returnedQuantity: 0,
      refundedMinor: 0,
    },
  ],
  tenders: [{ kind: 'cash', amountMinor: 1992 }],
  returns: [],
}

describe('RetailFlow dialogs', () => {
  beforeEach(() => {
    stubRetailContentModel()
    stubNativeDialogs()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('splits a simulated tender into exact minor-unit amounts', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithRetailContent(
      <CheckoutDialog totalMinor={1992} busy={false} online error={null} onClose={vi.fn()} onSubmit={onSubmit} />,
    )

    await screen.findByRole('dialog', { name: 'Choose tender' }, { timeout: 5000 })
    await user.click(screen.getByRole('button', { name: 'Split between two tenders' }))
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))

    expect(onSubmit).toHaveBeenCalledWith([
      { kind: 'cash', amountMinor: 996 },
      { kind: 'sandbox', amountMinor: 996 },
    ])
  })

  it('allows only a simulated cash draft while offline', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithRetailContent(
      <CheckoutDialog
        totalMinor={1992}
        busy={false}
        online={false}
        error="Try again"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await screen.findByRole('dialog', { name: 'Choose tender' }, { timeout: 5000 })
    expect(screen.getByRole('option', { name: 'Sandbox card simulation' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert').textContent).toBe('Try again')
    await user.click(screen.getByRole('button', { name: 'Save cash draft' }))

    expect(onSubmit).toHaveBeenCalledWith([{ kind: 'cash', amountMinor: 1992 }])
  })

  it('submits selected return quantities and renders the receipt', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithRetailContent(
      <ReturnDialog sale={sale} busy={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />,
    )

    await screen.findByRole('dialog', { name: 'Return items' })
    await user.type(screen.getByRole('spinbutton', { name: 'Quantity of Daybreak Coffee Beans to return' }), '1')
    await user.click(screen.getByRole('button', { name: 'Record simulated refund' }))
    expect(onSubmit).toHaveBeenCalledWith([{ saleLineId: 'sale-line-01', quantity: 1 }], 'customer_request')

    cleanup()
    renderWithRetailContent(<ReceiptDialog sale={sale} onClose={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Receipt' })
    expect(screen.getByText('RF-20261030-TEST0001')).toBeTruthy()
  })

  it('validates a split tender before allowing a single tender checkout', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithRetailContent(
      <CheckoutDialog totalMinor={1992} busy={false} online error={null} onClose={vi.fn()} onSubmit={onSubmit} />,
    )

    await screen.findByRole('dialog', { name: 'Choose tender' }, { timeout: 5000 })
    await user.click(screen.getByRole('button', { name: 'Split between two tenders' }))
    const firstAmount = screen.getByRole('textbox', { name: 'First tender amount' })
    const completeButton = screen.getByRole('button', { name: 'Complete sale' })

    await user.clear(firstAmount)
    await user.type(firstAmount, 'not-money')
    expect(completeButton).toHaveProperty('disabled', true)

    await user.clear(firstAmount)
    await user.type(firstAmount, '0')
    expect(completeButton).toHaveProperty('disabled', true)

    await user.clear(firstAmount)
    await user.type(firstAmount, '19.92')
    await user.click(screen.getByRole('button', { name: 'Use one tender' }))
    await user.click(completeButton)

    expect(onSubmit).toHaveBeenCalledWith([{ kind: 'cash', amountMinor: 1992 }])
  })

  it('shows return errors, disables exhausted lines, and honors a busy refund', async () => {
    const exhaustedSale: SaleDetail = {
      ...sale,
      status: 'returned',
      lines: sale.lines.map((line) => ({ ...line, returnedQuantity: line.quantity })),
    }
    renderWithRetailContent(
      <ReturnDialog
        sale={exhaustedSale}
        busy
        error="The refund could not be recorded."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    await screen.findByRole('dialog', { name: 'Return items' })
    expect(screen.getByRole('alert').textContent).toBe('The refund could not be recorded.')
    expect(screen.getByRole('spinbutton', { name: 'Quantity of Daybreak Coffee Beans to return' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'Recording…' })).toHaveProperty('disabled', true)
  })

  it('prints a discounted receipt and reports dialog close events', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const discountedSale: SaleDetail = {
      ...sale,
      discountMinor: 200,
      totalMinor: 1792,
      tenders: [
        { kind: 'sandbox', amountMinor: 1000 },
        { kind: 'cash', amountMinor: 792 },
      ],
    }
    renderWithRetailContent(<ReceiptDialog sale={discountedSale} onClose={onClose} />)

    await screen.findByRole('heading', { name: 'Receipt' })
    expect(screen.getByText('Discount')).toBeTruthy()
    expect(screen.getByText(/Sandbox tender/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Print receipt' }))
    expect(print).toHaveBeenCalledOnce()

    const dialog = screen.getByRole('dialog', { name: 'Receipt' }) as HTMLDialogElement
    dialog.close()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
