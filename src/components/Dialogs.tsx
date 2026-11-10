import { useEffect, useRef, useState } from 'react'
import { Check, CreditCard, Printer, RotateCcw, X } from 'lucide-react'
import type { SaleDetail } from '../api.js'
import { useContent } from '../content-context'
import { dataString, dataStringAt } from '../content-utils'
import { formatMoneyInput, parseMoneyInput } from '../domain/money.js'

type TenderKind = 'cash' | 'sandbox'

function useDialog(onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
  }, [])

  return { dialogRef, onClose }
}

interface CheckoutDialogProps {
  totalMinor: number
  busy: boolean
  online: boolean
  error: string | null
  onClose: () => void
  onSubmit: (tenders: Array<{ kind: TenderKind; amountMinor: number }>) => void
}

export function CheckoutDialog({ totalMinor, busy, online, error, onClose, onSubmit }: CheckoutDialogProps) {
  const { model, t } = useContent()
  const formatMoney = (amountMinor: number) =>
    new Intl.NumberFormat(model.locale, {
      style: 'currency',
      currency: dataString(model, 'currency.code'),
    }).format(amountMinor / 100)
  const { dialogRef } = useDialog(onClose)
  const [split, setSplit] = useState(false)
  const [firstKind, setFirstKind] = useState<TenderKind>('cash')
  const [secondKind, setSecondKind] = useState<TenderKind>('sandbox')
  const [firstAmount, setFirstAmount] = useState(formatMoneyInput(totalMinor))
  const firstMinor = parseMoneyInput(firstAmount)
  const remainingMinor = firstMinor === null ? -1 : totalMinor - firstMinor

  useEffect(() => setFirstAmount(formatMoneyInput(totalMinor)), [totalMinor])

  function toggleSplit(): void {
    setSplit((current) => {
      const next = !current
      if (next) setFirstAmount(formatMoneyInput(Math.floor(totalMinor / 2)))
      return next
    })
  }

  function submit(): void {
    if (firstMinor === null || firstMinor < 1 || remainingMinor < (split ? 1 : 0)) return

    const tenders = split
      ? [
          { kind: firstKind, amountMinor: firstMinor },
          { kind: secondKind, amountMinor: remainingMinor },
        ]
      : [{ kind: firstKind, amountMinor: totalMinor }]
    onSubmit(tenders)
  }

  return (
    <dialog
      className="modal checkout-modal"
      ref={dialogRef}
      aria-labelledby="tender-heading"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="modal-heading">
        <div className="modal-icon">
          <CreditCard size={19} aria-hidden="true" />
        </div>
        <div>
          <div className="eyebrow">{t('checkout.eyebrow')}</div>
          <h2 id="tender-heading">{t('checkout.title')}</h2>
        </div>
        <button className="icon-button modal-close" type="button" aria-label={t('checkout.close')} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="tender-total">
        <span>{t('checkout.amountDue')}</span>
        <strong>{formatMoney(totalMinor)}</strong>
      </div>
      <label className="field-label" htmlFor="tender-kind">
        {t('checkout.method')}
      </label>
      <select id="tender-kind" value={firstKind} onChange={(event) => setFirstKind(event.target.value as TenderKind)}>
        <option value="cash">{t('checkout.cash')}</option>
        <option value="sandbox" disabled={!online}>
          {t('checkout.sandboxTender')}
        </option>
      </select>

      {split && (
        <>
          <label className="field-label" htmlFor="first-tender-amount">
            {t('checkout.firstAmount')}
          </label>
          <div className="money-input-wrap">
            <span>{dataString(model, 'currency.symbol')}</span>
            <input
              id="first-tender-amount"
              inputMode="decimal"
              value={firstAmount}
              onChange={(event) => setFirstAmount(event.target.value)}
              aria-describedby="split-remainder"
            />
          </div>
          <label className="field-label" htmlFor="second-tender-kind">
            {t('checkout.remainingBalance')}
          </label>
          <div className="split-remainder" id="split-remainder">
            <select
              id="second-tender-kind"
              value={secondKind}
              onChange={(event) => setSecondKind(event.target.value as TenderKind)}
            >
              <option value="cash">{t('checkout.cash')}</option>
              <option value="sandbox" disabled={!online}>
                {t('checkout.sandboxTender')}
              </option>
            </select>
            <strong>{remainingMinor >= 0 ? formatMoney(remainingMinor) : t('checkout.adjustAmount')}</strong>
          </div>
        </>
      )}

      <button className="split-toggle" type="button" onClick={toggleSplit}>
        {split ? t('checkout.useOneTender') : t('checkout.splitTender')}
      </button>
      <p className="security-note">{online ? t('checkout.onlineSecurity') : t('checkout.offlineSecurity')}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          {t('checkout.back')}
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={submit}
          disabled={busy || firstMinor === null || firstMinor < 1 || remainingMinor < (split ? 1 : 0)}
        >
          {busy ? t('checkout.recording') : online ? t('checkout.completeSale') : t('checkout.saveDraft')}{' '}
          <Check size={17} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  )
}

interface ReceiptDialogProps {
  sale: SaleDetail
  onClose: () => void
}

export function ReceiptDialog({ sale, onClose }: ReceiptDialogProps) {
  const { model, t } = useContent()
  const formatMoney = (amountMinor: number) =>
    new Intl.NumberFormat(model.locale, {
      style: 'currency',
      currency: dataString(model, 'currency.code'),
    }).format(amountMinor / 100)
  const { dialogRef } = useDialog(onClose)

  return (
    <dialog className="modal receipt-modal" ref={dialogRef} aria-labelledby="receipt-heading" onClose={onClose}>
      <div className="receipt-topline">
        <span className="receipt-mark">
          <Check size={16} aria-hidden="true" />
        </span>
        <span>{t('receipt.saleRecorded')}</span>
        <button className="icon-button modal-close" type="button" aria-label={t('receipt.close')} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="receipt-paper">
        <p className="receipt-store">{dataString(model, 'receipt.store')}</p>
        <h2 id="receipt-heading">{t('receipt.title')}</h2>
        <div className="receipt-meta">
          <span>{sale.receiptNumber}</span>
          <time dateTime={sale.createdAt}>
            {new Intl.DateTimeFormat(model.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(sale.createdAt),
            )}
          </time>
        </div>
        <div className="receipt-items">
          {sale.lines.map((line) => (
            <div className="receipt-line" key={line.id}>
              <span>
                {line.quantity} × {dataStringAt(model, 'productLabels', line.sku, 'name')}
              </span>
              <strong>{formatMoney(line.totalMinor)}</strong>
            </div>
          ))}
        </div>
        <div className="receipt-summary">
          <div>
            <span>{t('receipt.subtotal')}</span>
            <span>{formatMoney(sale.subtotalMinor)}</span>
          </div>
          {sale.discountMinor > 0 && (
            <div>
              <span>{t('receipt.discount')}</span>
              <span>−{formatMoney(sale.discountMinor)}</span>
            </div>
          )}
          <div>
            <span>{t('receipt.tax')}</span>
            <span>{formatMoney(sale.taxMinor)}</span>
          </div>
          <div className="receipt-total">
            <span>{t('receipt.total')}</span>
            <strong>{formatMoney(sale.totalMinor)}</strong>
          </div>
        </div>
        <div className="receipt-tenders">
          {sale.tenders.map((tender, index) => (
            <span key={`${tender.kind}-${index}`}>
              {t(tender.kind === 'sandbox' ? 'receipt.sandboxTender' : 'receipt.cashTender')} ·{' '}
              {formatMoney(tender.amountMinor)}
            </span>
          ))}
        </div>
        <p className="receipt-disclaimer">{t('receipt.disclaimer')}</p>
      </div>
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          {t('receipt.done')}
        </button>
        <button className="primary-button" type="button" onClick={() => window.print()}>
          {t('receipt.print')} <Printer size={16} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  )
}

interface ReturnDialogProps {
  sale: SaleDetail
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (
    items: Array<{ saleLineId: string; quantity: number }>,
    reason: 'customer_request' | 'damaged' | 'other',
  ) => void
}

export function ReturnDialog({ sale, busy, error, onClose, onSubmit }: ReturnDialogProps) {
  const { model, t } = useContent()
  const formatMoney = (amountMinor: number) =>
    new Intl.NumberFormat(model.locale, {
      style: 'currency',
      currency: dataString(model, 'currency.code'),
    }).format(amountMinor / 100)
  const { dialogRef } = useDialog(onClose)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<'customer_request' | 'damaged' | 'other'>('customer_request')
  const requestedItems = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([saleLineId, quantity]) => ({ saleLineId, quantity }))

  return (
    <dialog className="modal return-modal" ref={dialogRef} aria-labelledby="return-heading" onClose={onClose}>
      <div className="modal-heading">
        <div className="modal-icon">
          <RotateCcw size={19} aria-hidden="true" />
        </div>
        <div>
          <div className="eyebrow">{t('return.eyebrow')}</div>
          <h2 id="return-heading">{t('return.title')}</h2>
        </div>
        <button className="icon-button modal-close" type="button" aria-label={t('return.close')} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <p className="dialog-intro">{t('return.description', { receipt: sale.receiptNumber })}</p>
      <div className="return-line-list">
        {sale.lines.map((line) => {
          const remaining = line.quantity - line.returnedQuantity
          return (
            <label className="return-line" key={line.id}>
              <span>
                <strong>{dataStringAt(model, 'productLabels', line.sku, 'name')}</strong>
                <small>{t('return.returnable', { count: remaining, amount: formatMoney(line.totalMinor) })}</small>
              </span>
              <input
                aria-label={t('return.quantityLabel', {
                  name: dataStringAt(model, 'productLabels', line.sku, 'name'),
                })}
                type="number"
                min={0}
                max={remaining}
                step={1}
                value={quantities[line.id] ?? 0}
                disabled={remaining === 0}
                onChange={(event) =>
                  setQuantities((current) => ({
                    ...current,
                    [line.id]: Math.min(remaining, Math.max(0, Number(event.target.value))),
                  }))
                }
              />
            </label>
          )
        })}
      </div>
      <label className="field-label" htmlFor="return-reason">
        {t('return.reason')}
      </label>
      <select id="return-reason" value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
        <option value="customer_request">{t('return.reason.customer_request')}</option>
        <option value="damaged">{t('return.reason.damaged')}</option>
        <option value="other">{t('return.reason.other')}</option>
      </select>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          {t('return.cancel')}
        </button>
        <button
          className="primary-button danger-button"
          type="button"
          disabled={busy || requestedItems.length === 0}
          onClick={() => onSubmit(requestedItems, reason)}
        >
          {busy ? t('return.recording') : t('return.record')} <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  )
}
