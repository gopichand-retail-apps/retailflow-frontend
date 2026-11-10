import { useDeferredValue, useState } from 'react'
import { Barcode, Plus, Search, TriangleAlert } from 'lucide-react'
import type { Product } from '../api.js'
import { useContent } from '../content-context'
import { dataString, dataStringAt, dataStringRecord } from '../content-utils'

interface ProductCatalogProps {
  products: Product[]
  onAdd: (product: Product) => void
  onScan: (value: string) => void
}

export function ProductCatalog({ products, onAdd, onScan }: ProductCatalogProps) {
  const { model, t } = useContent()
  const categoryLabels = dataStringRecord(model, 'categoryLabels')
  const formatMoney = (amountMinor: number) =>
    new Intl.NumberFormat(model.locale, {
      style: 'currency',
      currency: dataString(model, 'currency.code'),
    }).format(amountMinor / 100)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const categories = ['', ...new Set(products.map((product) => product.category))]
  const visibleProducts = products.filter((product) => {
    const localizedName = dataStringAt(model, 'productLabels', product.sku, 'name')
    const localizedDescription = dataStringAt(model, 'productLabels', product.sku, 'description')
    const localizedCategory = categoryLabels[product.category]
    if (!localizedCategory) throw new Error(`CONTENT_CATEGORY_MISSING:${product.category}`)
    const matchesSearch = [localizedName, localizedDescription, product.sku, product.barcode, localizedCategory].some(
      (value) => value.toLowerCase().includes(deferredSearch),
    )
    return matchesSearch && (!category || product.category === category)
  })

  return (
    <section className="catalog" aria-labelledby="catalog-heading">
      <div className="catalog-heading-row">
        <div>
          <div className="eyebrow">{t('catalog.eyebrow')}</div>
          <h1 id="catalog-heading">{t('catalog.title')}</h1>
          <p>{t('catalog.description')}</p>
        </div>
        <span className="catalog-count">{t('catalog.itemCount', { count: visibleProducts.length })}</span>
      </div>

      <label className="catalog-search">
        <Search aria-hidden="true" size={19} />
        <span className="sr-only">{t('catalog.searchLabel')}</span>
        <input
          aria-label={t('catalog.searchLabel')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && search.trim()) onScan(search.trim())
          }}
          placeholder={t('catalog.searchPlaceholder')}
          autoComplete="off"
        />
        <kbd>
          <Barcode size={15} aria-hidden="true" /> {t('catalog.enter')}
        </kbd>
      </label>

      <div className="category-strip" aria-label={t('catalog.categoriesLabel')}>
        {categories.map((item) => (
          <button
            className={category === item ? 'category-tab is-active' : 'category-tab'}
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            aria-pressed={category === item}
          >
            {item ? categoryLabels[item] : t('catalog.allItems')}
          </button>
        ))}
      </div>

      {visibleProducts.length > 0 ? (
        <div className="product-grid">
          {visibleProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <button
                className="product-add"
                type="button"
                aria-label={t('catalog.addProduct', {
                  name: dataStringAt(model, 'productLabels', product.sku, 'name'),
                })}
                title={t('catalog.addToBasket')}
                onClick={() => onAdd(product)}
                disabled={product.stockQuantity === 0}
              >
                <Plus size={18} aria-hidden="true" />
              </button>
              <div className={`product-image product-image-${product.category.toLowerCase()}`}>
                <img
                  src={product.imageUrl}
                  alt={dataStringAt(model, 'productLabels', product.sku, 'name')}
                  loading="lazy"
                  onError={(event) => event.currentTarget.classList.add('is-missing')}
                />
                <span className="product-category">{categoryLabels[product.category]}</span>
              </div>
              <div className="product-copy">
                <div className="product-title-row">
                  <h2>{dataStringAt(model, 'productLabels', product.sku, 'name')}</h2>
                  {product.stockQuantity <= product.lowStockThreshold && (
                    <TriangleAlert size={15} className="stock-warning" aria-label={t('catalog.lowStock')} />
                  )}
                </div>
                <p>{dataStringAt(model, 'productLabels', product.sku, 'description')}</p>
                <div className="product-meta">
                  <strong>{formatMoney(product.unitPriceMinor)}</strong>
                  <span>{t('catalog.stockCount', { count: product.stockQuantity })}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state catalog-empty">
          <Search size={24} aria-hidden="true" />
          <h2>{t('catalog.emptyTitle')}</h2>
          <p>{t('catalog.emptyDescription')}</p>
        </div>
      )}
    </section>
  )
}
