import { Minus, Plus, ShoppingBag, Tag, Trash2 } from 'lucide-react'
import type { DemoUser, Product } from '../api.js'
import { useContent } from '../content-context'
import { dataStringAt } from '../content-utils'
import type { CartEntry, CartTotals } from '../domain/money.js'

interface CartPanelProps {
  entries: CartEntry[]
  totals: CartTotals
  products: Product[]
  user: DemoUser
  discountBasisPoints: number
  onDiscountChange: (value: number) => void
  onQuantityChange: (productId: string, quantity: number) => void
  onCheckout: () => void
}

const DISCOUNTS_BY_ROLE: Record<DemoUser['role'], number[]> = {
  cashier: [0, 500, 1000],
  supervisor: [0, 500, 1000, 2500, 5000],
  store_admin: [0, 500, 1000, 2500, 5000, 10_000],
}

export function CartPanel({
  entries,
  totals,
  products,
  user,
  discountBasisPoints,
  onDiscountChange,
  onQuantityChange,
  onCheckout,
}: CartPanelProps) {
  const { model, t } = useContent()
  const formatMoney = (amountMinor: number) =>
    new Intl.NumberFormat(model.locale, {
      style: 'currency',
      currency: 'USD',
    }).format(amountMinor / 100)
  const itemCount = entries.reduce((sum, entry) => sum + entry.quantity, 0)
  const discountOptions = DISCOUNTS_BY_ROLE[user.role]

  return (
    <aside className="cart-panel" aria-labelledby="cart-heading">
      <div className="cart-heading-row">
        <div>
          <div className="eyebrow">{t('cart.eyebrow')}</div>
          <h2 id="cart-heading">{t('cart.title')}</h2>
        </div>
        <span className="cart-count">{itemCount}</span>
      </div>

      {entries.length === 0 ? (
        <div className="cart-empty">
          <span className="cart-empty-icon">
            <ShoppingBag size={21} aria-hidden="true" />
          </span>
          <strong>{t('cart.emptyTitle')}</strong>
          <span>{t('cart.emptyDescription')}</span>
        </div>
      ) : (
        <div className="cart-lines">
          {entries.map(({ product, quantity }) => (
            <div className="cart-line" key={product.id}>
              <img src={product.imageUrl} alt="" onError={(event) => event.currentTarget.classList.add('is-missing')} />
              <div className="cart-line-copy">
                <strong>{dataStringAt(model, 'productLabels', product.sku, 'name')}</strong>
                <span>{formatMoney(product.unitPriceMinor)}</span>
                <div
                  className="quantity-stepper"
                  aria-label={t('cart.quantity', {
                    name: dataStringAt(model, 'productLabels', product.sku, 'name'),
                  })}
                >
                  <button
                    type="button"
                    aria-label={t('cart.removeOne', {
                      name: dataStringAt(model, 'productLabels', product.sku, 'name'),
                    })}
                    title={t('cart.removeOneTitle')}
                    onClick={() => onQuantityChange(product.id, quantity - 1)}
                  >
                    {quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                  </button>
                  <span aria-live="polite">{quantity}</span>
                  <button
                    type="button"
                    aria-label={t('cart.addOne', {
                      name: dataStringAt(model, 'productLabels', product.sku, 'name'),
                    })}
                    title={t('cart.addOneTitle')}
                    disabled={quantity >= product.stockQuantity}
                    onClick={() => onQuantityChange(product.id, quantity + 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <strong className="cart-line-total">{formatMoney(product.unitPriceMinor * quantity)}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="cart-controls">
        <label className="discount-select">
          <span>
            <Tag size={15} aria-hidden="true" /> {t('cart.discount')}
          </span>
          <select
            value={discountBasisPoints}
            onChange={(event) => onDiscountChange(Number(event.target.value))}
            disabled={entries.length === 0}
          >
            {discountOptions.map((basisPoints) => (
              <option value={basisPoints} key={basisPoints}>
                {basisPoints === 0 ? t('cart.discountNone') : t('cart.discountPercent', { percent: basisPoints / 100 })}
              </option>
            ))}
          </select>
        </label>
        <p className="demo-note">{t('cart.pricingNote')}</p>
      </div>

      <div className="cart-totals">
        <div>
          <span>{t('cart.subtotal')}</span>
          <strong>{formatMoney(totals.subtotalMinor)}</strong>
        </div>
        {totals.discountMinor > 0 && (
          <div className="discount-row">
            <span>{t('cart.discountLine')}</span>
            <strong>−{formatMoney(totals.discountMinor)}</strong>
          </div>
        )}
        <div>
          <span>{t('cart.tax')}</span>
          <strong>{formatMoney(totals.taxMinor)}</strong>
        </div>
        <div className="cart-grand-total">
          <span>{t('cart.total')}</span>
          <strong>{formatMoney(totals.totalMinor)}</strong>
        </div>
      </div>

      <button className="primary-button checkout-button" type="button" disabled={!entries.length} onClick={onCheckout}>
        <span>{t('cart.continueTender')}</span>
        <strong>{formatMoney(totals.totalMinor)}</strong>
      </button>
      <p className="tender-footnote">{t('cart.sandboxNote')}</p>
      <span className="sr-only">{t('cart.catalogLoaded', { count: products.length })}</span>
    </aside>
  )
}
