import { Barcode, Boxes, ChartColumn, Check, Cloud, CloudOff, LogOut, Receipt } from 'lucide-react'
import type { CheckoutRequest, DemoUser, Overview, Product, SaleDetail, SaleSummary } from '../api'
import { APP_VERSION } from '../app-version'
import { useContent } from '../content-context'
import { dataString } from '../content-utils'
import { CartPanel } from './CartPanel'
import { CheckoutDialog, ReceiptDialog, ReturnDialog } from './Dialogs'
import { ProductCatalog } from './ProductCatalog'
import { InventoryView, SalesView, SettingsView } from './StoreViews'
import type { CartEntry, CartTotals } from '../domain/money'

export type ViewId = 'checkout' | 'sales' | 'inventory' | 'settings'

interface NavigationItem {
  id: ViewId
  label: string
  icon: typeof Receipt
  count?: number
}

interface SidebarNavigationProps {
  user: DemoUser
  view: ViewId
  items: NavigationItem[]
  onChange: (view: ViewId) => void
  onLogout: () => void
}

export function SidebarNavigation({ user, view, items, onChange, onLogout }: SidebarNavigationProps) {
  const { model, t } = useContent()
  const displayName = user.displayName
  const initials = displayName
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const roleKey = user.role === 'store_admin' ? 'storeAdmin' : user.role

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="brand-mark">
          <Barcode size={20} />
        </span>
        <span>{t('brand.name')}</span>
      </div>
      <div className="store-switcher">
        <span className="store-avatar">{dataString(model, 'store.initial')}</span>
        <span>
          <strong>{dataString(model, 'store.name')}</strong>
          <small>{dataString(model, 'store.code')}</small>
        </span>
        <span className="switcher-dot" />
      </div>
      <nav className="main-nav" aria-label={t('navigation.primary')}>
        <span className="nav-caption">{t('environment.workspace')}</span>
        {items.map(({ id, label, icon: Icon, count }) => (
          <button
            type="button"
            key={id}
            className={view === id ? 'nav-item is-active' : 'nav-item'}
            onClick={() => onChange(id)}
            aria-current={view === id ? 'page' : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            {count !== undefined && <span className="nav-count">{count}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-status">
          <span className="status-light" />
          <span>{t('environment.local')}</span>
          <Check className="status-check" size={13} />
        </div>
        <div className="profile-row">
          <span className="profile-avatar">{initials}</span>
          <span className="profile-copy">
            <small>{t('app.releaseVersion', { version: APP_VERSION })}</small>
            <strong>{displayName}</strong>
            <small>{t(`login.role.${roleKey}`)}</small>
          </span>
          <button
            className="icon-button profile-logout"
            type="button"
            title={t('navigation.signOutTitle')}
            aria-label={t('navigation.signOut')}
            onClick={onLogout}
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}

interface PendingBannerProps {
  count: number
  online: boolean
  onRetry: () => void
  onClear: () => void
}

export function PendingBanner({ count, online, onRetry, onClear }: PendingBannerProps) {
  const { t } = useContent()
  if (count === 0) return null
  const ConnectionIcon = online ? Cloud : CloudOff

  return (
    <div className="pending-banner" role="status">
      <span className="pending-icon">
        <CloudOff size={17} aria-hidden="true" />
      </span>
      <span>
        <strong>{t(count === 1 ? 'workspace.offlineDraft.one' : 'workspace.offlineDraft.other', { count })}</strong>
        <small>{t('workspace.draftSyncNote')}</small>
      </span>
      <button className="secondary-button" type="button" disabled={!online} onClick={onRetry}>
        <ConnectionIcon size={14} aria-hidden="true" /> {t('workspace.retrySync')}
      </button>
      <button className="text-button" type="button" onClick={onClear}>
        {t('workspace.clear')}
      </button>
    </div>
  )
}

export function NoticeBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const { t } = useContent()
  if (!message) return null

  return (
    <div className="notice-bar" role="status">
      <Check size={16} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" className="notice-close" aria-label={t('workspace.dismissMessage')} onClick={onDismiss}>
        x
      </button>
    </div>
  )
}

function CheckoutStats({ overview }: { overview: Overview }) {
  const { model, t } = useContent()
  const gross = new Intl.NumberFormat(model.locale, {
    style: 'currency',
    currency: dataString(model, 'currency.code'),
    maximumFractionDigits: 0,
  }).format(overview.grossMinor / 100)

  return (
    <div className="quick-stats" aria-label={t('page.today')}>
      <div className="quick-stat">
        <span className="stat-icon stat-sales">
          <ChartColumn size={17} aria-hidden="true" />
        </span>
        <span>
          <small>{t('workspace.stat.salesToday')}</small>
          <strong>{overview.salesToday}</strong>
        </span>
      </div>
      <div className="quick-stat">
        <span className="stat-icon stat-revenue">
          <Receipt size={17} aria-hidden="true" />
        </span>
        <span>
          <small>{t('workspace.stat.grossSales')}</small>
          <strong>{gross}</strong>
        </span>
      </div>
      <div className="quick-stat">
        <span className="stat-icon stat-stock">
          <Boxes size={17} aria-hidden="true" />
        </span>
        <span>
          <small>{t('workspace.stat.lowStock')}</small>
          <strong>
            {overview.lowStockCount}
            <small className="stat-sub"> / {t('workspace.stat.skuCount', { count: overview.productCount })}</small>
          </strong>
        </span>
      </div>
    </div>
  )
}

interface CheckoutPageProps {
  overview: Overview
  dataLoading: boolean
  products: Product[]
  entries: CartEntry[]
  totals: CartTotals
  user: DemoUser
  discountBasisPoints: number
  onAdd: (product: Product) => void
  onScan: (value: string) => void
  onQuantityChange: (productId: string, quantity: number) => void
  onDiscountChange: (value: number) => void
  onCheckout: () => void
}

export function CheckoutPage({
  overview,
  dataLoading,
  products,
  entries,
  totals,
  user,
  discountBasisPoints,
  onAdd,
  onScan,
  onQuantityChange,
  onDiscountChange,
  onCheckout,
}: CheckoutPageProps) {
  const { t } = useContent()
  return (
    <div className="checkout-workspace">
      <div className="catalog-column">
        <CheckoutStats overview={overview} />
        {dataLoading ? (
          <div className="loading-inline">{t('workspace.productLoading')}</div>
        ) : (
          <ProductCatalog products={products} onAdd={onAdd} onScan={onScan} />
        )}
      </div>
      <CartPanel
        entries={entries}
        totals={totals}
        products={products}
        user={user}
        discountBasisPoints={discountBasisPoints}
        onDiscountChange={onDiscountChange}
        onQuantityChange={onQuantityChange}
        onCheckout={onCheckout}
      />
    </div>
  )
}

interface WorkspacePageProps {
  view: ViewId
  overview: Overview
  dataLoading: boolean
  products: Product[]
  entries: CartEntry[]
  totals: CartTotals
  sales: SaleSummary[]
  selectedSale: SaleDetail | null
  user: DemoUser
  storeName: string
  taxBasisPoints: number
  discountBasisPoints: number
  busy: boolean
  onAdd: (product: Product) => void
  onScan: (value: string) => void
  onQuantityChange: (productId: string, quantity: number) => void
  onDiscountChange: (value: number) => void
  onCheckout: () => void
  onSaleSelect: (saleId: string) => void
  onReturn: (sale: SaleDetail) => void
  onAdjustStock: (productId: string, delta: number, reason: string) => void
  onSaveRate: (basisPoints: number) => void
}

export function WorkspacePage(props: WorkspacePageProps) {
  switch (props.view) {
    case 'checkout':
      return <CheckoutPage {...props} />
    case 'sales':
      return (
        <SalesView
          sales={props.sales}
          selectedSale={props.selectedSale}
          user={props.user}
          onSelect={props.onSaleSelect}
          onReturn={props.onReturn}
        />
      )
    case 'inventory':
      return <InventoryView products={props.products} user={props.user} onAdjust={props.onAdjustStock} />
    case 'settings':
      return (
        <SettingsView
          storeName={props.storeName}
          taxBasisPoints={props.taxBasisPoints}
          isAdmin={props.user.role === 'store_admin'}
          busy={props.busy}
          onSave={props.onSaveRate}
        />
      )
  }
}

interface DialogLayerProps {
  checkoutOpen: boolean
  checkoutError: string | null
  busy: boolean
  online: boolean
  totalMinor: number
  receipt: SaleDetail | null
  returningSale: SaleDetail | null
  returnError: string | null
  onCloseCheckout: () => void
  onCheckout: (tenders: CheckoutRequest['tenders']) => void
  onCloseReceipt: () => void
  onCloseReturn: () => void
  onReturn: (
    items: Array<{ saleLineId: string; quantity: number }>,
    reason: 'customer_request' | 'damaged' | 'other',
  ) => void
}

export function DialogLayer(props: DialogLayerProps) {
  return (
    <>
      {props.checkoutOpen && (
        <CheckoutDialog
          totalMinor={props.totalMinor}
          busy={props.busy}
          online={props.online}
          error={props.checkoutError}
          onClose={props.onCloseCheckout}
          onSubmit={props.onCheckout}
        />
      )}
      {props.receipt && <ReceiptDialog sale={props.receipt} onClose={props.onCloseReceipt} />}
      {props.returningSale && (
        <ReturnDialog
          sale={props.returningSale}
          busy={props.busy}
          error={props.returnError}
          onClose={props.onCloseReturn}
          onSubmit={props.onReturn}
        />
      )}
    </>
  )
}
