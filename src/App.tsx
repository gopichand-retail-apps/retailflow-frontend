import { useEffect, useState } from 'react'
import { LoaderCircle, Boxes, Receipt, Settings, ShoppingBag } from 'lucide-react'
import {
  api,
  type CheckoutRequest,
  type DemoRole,
  type Overview,
  type Product,
  type SaleDetail,
  type SaleSummary,
} from './api'
import { useContent } from './content-context'
import { dataString, dataStringAt } from './content-utils'
import { StoreFooter, StoreHeader } from './components/AppChrome'
import { LoginScreen } from './components/LoginScreen'
import { formatStoreDate } from './date-utils'
import {
  DialogLayer,
  NoticeBanner,
  PendingBanner,
  SidebarNavigation,
  WorkspacePage,
  type ViewId,
} from './components/Workspace'
import { ReviewDraftsPanel } from './components/ReviewDrafts'
import { calculateCartTotals, formatMoney, type CartEntry } from './domain/money'
import { EMPTY_OVERVIEW } from './domain/overview'
import { errorMessage } from './error-message'
import { useDemoSession } from './use-demo-session'
import { useDraftQueue } from './use-draft-queue'
import { useWriteIntent } from './use-write-intent'
import { isMock } from './config'
import './App.css'

export default function App() {
  const { model, t } = useContent()
  const dataMode = isMock ? 'mock' : 'live'
  const { user, setUser, sessionLoading, roles, rolesLoading, rolesError } = useDemoSession(model, t)
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<SaleSummary[]>([])
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null)
  const [receipt, setReceipt] = useState<SaleDetail | null>(null)
  const [view, setView] = useState<ViewId>('checkout')
  const [basket, setBasket] = useState<Record<string, number>>({})
  const [discountBasisPoints, setDiscountBasisPoints] = useState(0)
  const [taxBasisPoints, setTaxBasisPoints] = useState(825)
  const storeName = dataString(model, 'store.name')
  const [dataLoading, setDataLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [returningSale, setReturningSale] = useState<SaleDetail | null>(null)
  const [returnError, setReturnError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW)
  const checkoutIntent = useWriteIntent()
  const returnIntent = useWriteIntent()
  const discardCheckoutIntent = checkoutIntent.discard
  const drafts = useDraftQueue(user, online, {
    onSynced: (sale) => {
      setNotice(t('notice.offlineSynced', { receipt: sale.receiptNumber }))
      setSales((current) => [sale, ...current.filter((entry) => entry.id !== sale.id)])
      setRefreshVersion((version) => version + 1)
    },
    onSyncFailed: (error) => setNotice(t('notice.offlineReview', { message: errorMessage(error, t, model.messages) })),
    onSaveFailed: () => setNotice(t('notice.offlineQueueSave')),
  })

  useEffect(() => {
    document.documentElement.dataset.mode = dataMode
    return () => {
      delete document.documentElement.dataset.mode
    }
  }, [dataMode])

  const cartEntries: CartEntry[] = products.flatMap((product) => {
    const quantity = basket[product.id] ?? 0
    return quantity > 0 ? [{ product, quantity }] : []
  })
  const totals = calculateCartTotals(cartEntries, discountBasisPoints, taxBasisPoints)
  const basketCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0)
  const basketFingerprint = JSON.stringify([
    cartEntries.map(({ product, quantity }) => [product.id, quantity]),
    discountBasisPoints,
  ])

  // A changed basket is a new intent: drop any unconfirmed checkout key and its awaiting state.
  useEffect(() => discardCheckoutIntent(), [basketFingerprint, discardCheckoutIntent])

  useEffect(() => {
    if (!user) return
    let active = true
    setDataLoading(true)
    Promise.all([api.products(), api.sales(), api.overview(), api.settings()])
      .then(([productResult, saleResult, overviewResult, settingsResult]) => {
        if (!active) return
        setProducts(productResult.products)
        setSales(saleResult.sales)
        setOverview(overviewResult)
        setTaxBasisPoints(settingsResult.settings.demoTaxBasisPoints)
      })
      .catch((error: unknown) => {
        if (active) setNotice(errorMessage(error, t, model.messages))
      })
      .finally(() => {
        if (active) setDataLoading(false)
      })
    return () => {
      active = false
    }
  }, [model.messages, refreshVersion, t, user])

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 5200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  async function login(role: DemoRole): Promise<void> {
    const result = await api.login(role)
    setUser(result.user)
    setView('checkout')
  }

  async function logout(): Promise<void> {
    try {
      await api.logout()
    } finally {
      // Unconfirmed keys belong to this operator's session. Saved drafts stay with their owner.
      checkoutIntent.discard()
      returnIntent.discard()
      setUser(null)
      setBasket({})
      setSelectedSale(null)
      setView('checkout')
    }
  }

  function addProduct(product: Product): void {
    setBasket((current) => ({
      ...current,
      [product.id]: Math.min(product.stockQuantity, (current[product.id] ?? 0) + 1),
    }))
  }

  function scanProduct(value: string): void {
    const normalized = value.toLowerCase()
    const product = products.find((candidate) => {
      return candidate.barcode.toLowerCase() === normalized || candidate.sku.toLowerCase() === normalized
    })
    if (!product) {
      setNotice(t('notice.productNotFound'))
      return
    }
    addProduct(product)
    setNotice(
      t('notice.productAdded', {
        name: dataStringAt(model, 'productLabels', product.sku, 'name'),
      }),
    )
  }

  function changeQuantity(productId: string, quantity: number): void {
    setBasket((current) => {
      const next = { ...current }
      if (quantity <= 0) delete next[productId]
      else next[productId] = quantity
      return next
    })
  }

  async function completeCheckout(tenders: CheckoutRequest['tenders']): Promise<void> {
    if (!user) return
    setBusy(true)
    setCheckoutError(null)
    const payload: CheckoutRequest = {
      items: cartEntries.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      discountBasisPoints,
      tenders,
    }
    // Created when the cashier confirms; reused for every retry of this exact payload.
    const idempotencyKey = checkoutIntent.keyFor(JSON.stringify(payload))
    try {
      if (!navigator.onLine && tenders.every((tender) => tender.kind === 'cash')) {
        throw new TypeError('NETWORK_UNAVAILABLE')
      }
      const result = await api.createSale(payload, idempotencyKey)
      checkoutIntent.discard()
      setSales((current) => [result.sale, ...current.filter((sale) => sale.id !== result.sale.id)])
      setOverview((current) => ({
        ...current,
        salesToday: current.salesToday + 1,
        grossMinor: current.grossMinor + result.sale.totalMinor,
      }))
      setBasket({})
      setDiscountBasisPoints(0)
      setCheckoutOpen(false)
      setSelectedSale(result.sale)
      setView('sales')
      setNotice(result.duplicate ? t('notice.duplicateSale') : t('notice.saleRecorded'))
      if (!result.duplicate) setReceipt(result.sale)
      setRefreshVersion((version) => version + 1)
    } catch (error) {
      const cashTender = tenders.every((tender) => tender.kind === 'cash')
      if (cashTender && (!navigator.onLine || error instanceof TypeError)) {
        // The key moves into the draft, which is bound to this operator and store.
        drafts.save({ idempotencyKey, createdAt: new Date().toISOString(), payload })
        checkoutIntent.discard()
        setBasket({})
        setDiscountBasisPoints(0)
        setCheckoutOpen(false)
        setNotice(t('notice.pendingDraft'))
      } else {
        checkoutIntent.failed(error)
        setCheckoutError(errorMessage(error, t, model.messages))
      }
    } finally {
      setBusy(false)
    }
  }

  async function openSale(saleId: string): Promise<void> {
    try {
      const result = await api.sale(saleId)
      setSelectedSale(result.sale)
    } catch (error) {
      setNotice(errorMessage(error, t, model.messages))
    }
  }

  async function recordReturn(
    items: Array<{ saleLineId: string; quantity: number }>,
    reason: 'customer_request' | 'damaged' | 'other',
  ): Promise<void> {
    if (!returningSale) return
    const saleId = returningSale.id
    setBusy(true)
    setReturnError(null)
    const request = { items, reason }
    const idempotencyKey = returnIntent.keyFor(JSON.stringify([saleId, request]))
    try {
      const result = await api.returnSale(saleId, request, idempotencyKey)
      returnIntent.discard()
      setReturningSale(null)
      setNotice(
        t('notice.refundRecorded', {
          amount: formatMoney(result.return.refundMinor, model.locale, dataString(model, 'currency.code')),
        }),
      )
      setRefreshVersion((version) => version + 1)
      // The return is confirmed. A failed refresh must not invite a second return from stale data.
      const refreshed = await api.sale(saleId).catch(() => null)
      setSelectedSale(refreshed?.sale ?? null)
    } catch (error) {
      returnIntent.failed(error)
      setReturnError(errorMessage(error, t, model.messages))
    } finally {
      setBusy(false)
    }
  }

  async function adjustStock(productId: string, quantityDelta: number, reason: string): Promise<void> {
    try {
      await api.adjustStock(productId, { quantityDelta, reason })
      setRefreshVersion((version) => version + 1)
      setNotice(t('notice.inventoryAdjusted'))
    } catch (error) {
      setNotice(errorMessage(error, t, model.messages))
    }
  }

  async function saveDemoRate(demoTaxBasisPoints: number): Promise<void> {
    setBusy(true)
    try {
      const result = await api.updateSettings(demoTaxBasisPoints)
      setTaxBasisPoints(result.settings.demoTaxBasisPoints)
      setNotice(t('notice.taxUpdated'))
    } catch (error) {
      setNotice(errorMessage(error, t, model.messages))
    } finally {
      setBusy(false)
    }
  }

  function setAsideDrafts(): void {
    if (!window.confirm(t('confirm.setAsideDrafts'))) return
    drafts.setAside()
    setNotice(t('notice.draftsSetAside'))
  }

  function closeReturn(): void {
    returnIntent.discard()
    setReturningSale(null)
  }

  if (sessionLoading)
    return (
      <main className="loading-screen">
        <LoaderCircle className="spin" size={27} />
        <span>{t('loading.openStore')}</span>
      </main>
    )
  if (!user) {
    return <LoginScreen onLogin={login} roles={roles} rolesLoading={rolesLoading} rolesError={rolesError} />
  }

  const today = formatStoreDate(model.locale)
  const navItems: Array<{ id: ViewId; label: string; icon: typeof ShoppingBag; count?: number }> = [
    { id: 'checkout', label: t('navigation.checkout'), icon: ShoppingBag, count: basketCount || undefined },
    { id: 'sales', label: t('navigation.sales'), icon: Receipt },
    { id: 'inventory', label: t('navigation.inventory'), icon: Boxes, count: overview.lowStockCount || undefined },
    { id: 'settings', label: t('navigation.settings'), icon: Settings },
  ]

  const activeLabel = navItems.find((item) => item.id === view)?.label ?? t('navigation.checkout')

  return (
    <div className="retail-shell" data-mode={dataMode}>
      <SidebarNavigation user={user} view={view} items={navItems} onChange={setView} onLogout={() => void logout()} />
      <main className="main-panel">
        <StoreHeader
          activeLabel={activeLabel}
          today={today}
          online={online}
          onHelp={() => setNotice(t('help.description'))}
        />
        <NoticeBanner message={notice ?? ''} onDismiss={() => setNotice(null)} />
        <PendingBanner
          count={drafts.mine.length}
          online={online}
          syncing={drafts.syncing}
          onRetry={drafts.retry}
          onSetAside={setAsideDrafts}
        />
        <ReviewDraftsPanel drafts={drafts.review} />
        <WorkspacePage
          view={view}
          overview={overview}
          dataLoading={dataLoading}
          products={products}
          entries={cartEntries}
          totals={totals}
          sales={sales}
          selectedSale={selectedSale}
          user={user}
          storeName={storeName}
          taxBasisPoints={taxBasisPoints}
          discountBasisPoints={discountBasisPoints}
          busy={busy}
          onAdd={addProduct}
          onScan={scanProduct}
          onQuantityChange={changeQuantity}
          onDiscountChange={setDiscountBasisPoints}
          onCheckout={() => {
            setCheckoutError(null)
            setCheckoutOpen(true)
          }}
          onSaleSelect={(saleId) => void openSale(saleId)}
          onReturn={(sale) => {
            setReturnError(null)
            setReturningSale(sale)
          }}
          onAdjustStock={(id, delta, reason) => void adjustStock(id, delta, reason)}
          onSaveRate={(rate) => void saveDemoRate(rate)}
        />
        <StoreFooter />
      </main>
      <DialogLayer
        checkoutOpen={checkoutOpen}
        checkoutError={checkoutError}
        checkoutAwaiting={checkoutIntent.awaiting}
        returnAwaiting={returnIntent.awaiting}
        busy={busy}
        online={online}
        totalMinor={totals.totalMinor}
        receipt={receipt}
        returningSale={returningSale}
        returnError={returnError}
        onCloseCheckout={() => setCheckoutOpen(false)}
        onCheckout={(tenders) => void completeCheckout(tenders)}
        onCloseReceipt={() => setReceipt(null)}
        onCloseReturn={closeReturn}
        onReturn={(items, reason) => void recordReturn(items, reason)}
      />
    </div>
  )
}
