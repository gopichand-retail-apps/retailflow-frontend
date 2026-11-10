import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, RotateCcw, Search, TriangleAlert } from 'lucide-react'
import type { DemoUser, Product, SaleDetail, SaleSummary } from '../api.js'
import { useContent } from '../content-context'
import { dataStringAt } from '../content-utils'

interface SalesViewProps {
  sales: SaleSummary[]
  selectedSale: SaleDetail | null
  user: DemoUser
  onSelect: (saleId: string) => void
  onReturn: (sale: SaleDetail) => void
}

function formatSalesTime(locale: string, timestamp: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp))
}

function formatSaleDate(locale: string, timestamp: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
}

export function SalesView({ sales, selectedSale, user, onSelect, onReturn }: SalesViewProps) {
  const { model, t } = useContent()
  const localizedMoney = (amount: number) =>
    new Intl.NumberFormat(model.locale, {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100)
  const [filter, setFilter] = useState('')
  const visibleSales = sales.filter((sale) => sale.receiptNumber.toLowerCase().includes(filter.toLowerCase()))
  const canReturn = user.role !== 'cashier'

  return (
    <section className="workspace-view" aria-labelledby="sales-heading">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">{t('sales.eyebrow')}</div>
          <h1 id="sales-heading">{t('sales.title')}</h1>
          <p>{t('sales.description')}</p>
        </div>
        <label className="table-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">{t('sales.searchLabel')}</span>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t('sales.searchPlaceholder')}
          />
        </label>
      </div>

      <div className="sales-layout">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('sales.column.receipt')}</th>
                <th>{t('sales.column.time')}</th>
                <th>{t('sales.column.status')}</th>
                <th className="numeric-cell">{t('sales.column.total')}</th>
                <th>
                  <span className="sr-only">{t('sales.openTransaction')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((sale) => (
                <tr key={sale.id} className={selectedSale?.id === sale.id ? 'is-selected' : ''}>
                  <td>
                    <button className="receipt-link" type="button" onClick={() => onSelect(sale.id)}>
                      {sale.receiptNumber}
                    </button>
                  </td>
                  <td>{formatSalesTime(model.locale, sale.createdAt)}</td>
                  <td>
                    <span className={`status-pill status-${sale.status}`}>{t(`sales.status.${sale.status}`)}</span>
                  </td>
                  <td className="numeric-cell">{localizedMoney(sale.totalMinor)}</td>
                  <td>
                    <button
                      className="icon-button row-open"
                      type="button"
                      aria-label={t('sales.openReceipt', { receipt: sale.receiptNumber })}
                      onClick={() => onSelect(sale.id)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleSales.length === 0 && (
            <div className="empty-state compact-empty">
              <p>{t('sales.empty')}</p>
            </div>
          )}
        </div>

        <aside className="sale-detail-panel" aria-label={t('sales.detailLabel')}>
          {selectedSale ? (
            <>
              <div className="detail-topline">
                <div>
                  <div className="eyebrow">{t('sales.transaction')}</div>
                  <h2>{selectedSale.receiptNumber}</h2>
                </div>
                <span className={`status-pill status-${selectedSale.status}`}>
                  {t(`sales.status.${selectedSale.status}`)}
                </span>
              </div>
              <p className="detail-date">{formatSaleDate(model.locale, selectedSale.createdAt)}</p>
              <div className="detail-lines">
                {selectedSale.lines.map((line) => (
                  <div className="detail-line" key={line.id}>
                    <span>
                      <strong>
                        {line.quantity} × {dataStringAt(model, 'productLabels', line.sku, 'name')}
                      </strong>
                      <small>{line.sku}</small>
                    </span>
                    <strong>{localizedMoney(line.totalMinor)}</strong>
                  </div>
                ))}
              </div>
              <div className="detail-total">
                <span>{t('sales.column.total')}</span>
                <strong>{localizedMoney(selectedSale.totalMinor)}</strong>
              </div>
              <div className="detail-tenders">
                {selectedSale.tenders.map((tender, index) => (
                  <span key={`${tender.kind}-${index}`}>
                    {t(tender.kind === 'sandbox' ? 'receipt.sandboxTender' : 'receipt.cashTender')} ·{' '}
                    {localizedMoney(tender.amountMinor)}
                  </span>
                ))}
              </div>
              {selectedSale.returns.map((item) => (
                <div className="return-record" key={item.id}>
                  <RotateCcw size={14} />
                  {t('sales.refund', {
                    amount: localizedMoney(item.refundMinor),
                    reason: t(`return.reason.${item.reason}`),
                  })}
                </div>
              ))}
              {canReturn && selectedSale.status !== 'returned' && (
                <button className="secondary-button return-action" type="button" onClick={() => onReturn(selectedSale)}>
                  {t('sales.recordReturn')} <RotateCcw size={15} aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <div className="detail-placeholder">
              <span>
                <ArrowDown size={18} />
              </span>
              <strong>{t('sales.selectReceipt')}</strong>
              <p>{t('sales.detailPlaceholder')}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

interface InventoryViewProps {
  products: Product[]
  user: DemoUser
  onAdjust: (productId: string, quantityDelta: number, reason: string) => void
}

export function InventoryView({ products, user, onAdjust }: InventoryViewProps) {
  const { model, t } = useContent()
  const canAdjust = user.role !== 'cashier'

  return (
    <section className="workspace-view" aria-labelledby="inventory-heading">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">{t('inventory.eyebrow')}</div>
          <h1 id="inventory-heading">{t('inventory.title')}</h1>
          <p>{t('inventory.description')}</p>
        </div>
        <span className="section-count">{t('inventory.skuCount', { count: products.length })}</span>
      </div>
      <div className="inventory-table table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('inventory.column.product')}</th>
              <th>{t('inventory.column.sku')}</th>
              <th>{t('inventory.column.onHand')}</th>
              <th>{t('inventory.column.reorder')}</th>
              <th>
                <span className="sr-only">{t('inventory.adjustStock')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isLow = product.stockQuantity <= product.lowStockThreshold
              return (
                <tr key={product.id}>
                  <td>
                    <div className="inventory-product">
                      <img
                        src={product.imageUrl}
                        alt=""
                        onError={(event) => event.currentTarget.classList.add('is-missing')}
                      />
                      <span>
                        <strong>{dataStringAt(model, 'productLabels', product.sku, 'name')}</strong>
                        <small>{dataStringAt(model, 'productLabels', product.sku, 'category')}</small>
                      </span>
                    </div>
                  </td>
                  <td>{product.sku}</td>
                  <td>
                    <span className={isLow ? 'stock-count is-low' : 'stock-count'}>
                      {isLow && <TriangleAlert size={14} aria-hidden="true" />}
                      {product.stockQuantity}
                    </span>
                  </td>
                  <td>{product.lowStockThreshold}</td>
                  <td>
                    {canAdjust ? (
                      <div className="stock-adjust-controls">
                        <button
                          className="icon-button"
                          type="button"
                          title={t('inventory.removeUnit')}
                          aria-label={t('inventory.removeProductUnit', {
                            name: dataStringAt(model, 'productLabels', product.sku, 'name'),
                          })}
                          disabled={product.stockQuantity === 0}
                          onClick={() => onAdjust(product.id, -1, t('inventory.cycleCountCorrection'))}
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          title={t('inventory.addUnit')}
                          aria-label={t('inventory.addProductUnit', {
                            name: dataStringAt(model, 'productLabels', product.sku, 'name'),
                          })}
                          onClick={() => onAdjust(product.id, 1, t('inventory.receivingCorrection'))}
                        >
                          <ArrowUp size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="permission-note">{t('inventory.supervisor')}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

interface SettingsViewProps {
  storeName: string
  taxBasisPoints: number
  isAdmin: boolean
  busy: boolean
  onSave: (basisPoints: number) => void
}

export function SettingsView({ storeName, taxBasisPoints, isAdmin, busy, onSave }: SettingsViewProps) {
  const { t } = useContent()
  const [rate, setRate] = useState((taxBasisPoints / 100).toFixed(2))
  const [error, setError] = useState('')

  useEffect(() => setRate((taxBasisPoints / 100).toFixed(2)), [taxBasisPoints])

  function saveSettings(): void {
    const rateNumber = Number(rate)
    if (!Number.isFinite(rateNumber) || rateNumber < 0 || rateNumber > 100) {
      setError(t('settings.rangeError'))
      return
    }

    setError('')
    onSave(Math.round(rateNumber * 100))
  }

  return (
    <section className="workspace-view" aria-labelledby="settings-heading">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">{t('settings.eyebrow')}</div>
          <h1 id="settings-heading">{t('settings.title')}</h1>
          <p>{t('settings.description')}</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <div className="eyebrow">{t('settings.general')}</div>
              <h2>{t('settings.profile')}</h2>
            </div>
          </div>
          <div className="settings-row">
            <span>
              <strong>{t('settings.storeName')}</strong>
              <small>{t('settings.storeNameNote')}</small>
            </span>
            <span className="settings-value">{storeName}</span>
          </div>
          <div className="settings-row">
            <span>
              <strong>{t('settings.environment')}</strong>
              <small>{t('settings.paymentNote')}</small>
            </span>
            <span className="demo-environment">{t('settings.localDemo')}</span>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <div className="eyebrow">{t('settings.pricing')}</div>
              <h2>{t('settings.taxRate')}</h2>
            </div>
            <span className="demo-only-badge">{t('settings.notTaxAdvice')}</span>
          </div>
          <p className="settings-explainer">{t('settings.explainer')}</p>
          <label className="field-label" htmlFor="tax-rate">
            {t('settings.percentage')}
          </label>
          <div className="rate-input-wrap">
            <input
              id="tax-rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={rate}
              disabled={!isAdmin || busy}
              onChange={(event) => setRate(event.target.value)}
            />
            <span>{t('unit.percentSymbol')}</span>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {isAdmin ? (
            <button className="primary-button settings-save" type="button" disabled={busy} onClick={saveSettings}>
              {busy ? t('settings.saving') : t('settings.saveRate')}
            </button>
          ) : (
            <p className="permission-note">{t('settings.adminRequired')}</p>
          )}
        </section>
        <section className="settings-section privacy-section">
          <div className="settings-section-header">
            <div>
              <div className="eyebrow">{t('settings.privacy')}</div>
              <h2>{t('settings.boundaries')}</h2>
            </div>
          </div>
          <ul>
            <li>{t('settings.privacy.profile')}</li>
            <li>{t('settings.privacy.tender')}</li>
            <li>{t('settings.privacy.offline')}</li>
          </ul>
        </section>
      </div>
    </section>
  )
}
