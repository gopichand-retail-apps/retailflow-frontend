import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../api'
import { ContentProvider } from '../content'
import { contentModelSchema } from '../content-schema'
import { dataStringAt } from '../content-utils'
import { ProductCatalog } from './ProductCatalog'

function renderCatalog(locale?: string, stockQuantity = 18) {
  const model = contentModelSchema.parse(
    JSON.parse(readFileSync(resolve(process.cwd(), 'public/retailflow-model.json'), 'utf8')),
  )
  if (locale) {
    model.locale = locale
    model.messages['catalog.searchLabel'] = 'Localized product search'
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => model,
    }),
  )

  const product: Product = {
    id: 'product-coffee-beans',
    sku: 'PAN-2041',
    barcode: '850000000001',
    name: dataStringAt(model, 'productLabels', 'PAN-2041', 'name'),
    description: dataStringAt(model, 'productLabels', 'PAN-2041', 'description'),
    category: dataStringAt(model, 'productLabels', 'PAN-2041', 'category'),
    unitPriceMinor: 1840,
    stockQuantity,
    lowStockThreshold: 6,
    imageUrl: '/images/coffee-beans.webp',
  }
  const result = render(
    <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
      <ProductCatalog products={[product]} onAdd={onAdd} onScan={onScan} />
    </ContentProvider>,
  )
  return { ...result, model, product }
}

let onAdd: (product: Product) => void
let onScan: (value: string) => void

beforeEach(() => {
  onAdd = vi.fn()
  onScan = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProductCatalog', () => {
  it('submits a scanned barcode when Enter is pressed', async () => {
    const { model } = renderCatalog()
    const search = await screen.findByLabelText(model.messages['catalog.searchLabel'])

    fireEvent.change(search, { target: { value: '850000000001' } })
    fireEvent.keyDown(search, { key: 'Enter' })

    expect(onScan).toHaveBeenCalledWith('850000000001')
  })

  it('adds a catalog product using model-backed accessible copy', async () => {
    const { model, product } = renderCatalog()
    const productName = dataStringAt(model, 'productLabels', product.sku, 'name')
    const addLabel = model.messages['catalog.addProduct'].replace('{{name}}', productName)

    fireEvent.click(await screen.findByRole('button', { name: addLabel }))

    expect(onAdd).toHaveBeenCalledWith(product)
  })

  it('uses the replacement model locale and copy without changing application code', async () => {
    const { model } = renderCatalog('fr-FR')

    expect(await screen.findByLabelText('Localized product search')).toBeTruthy()
    expect(document.documentElement.lang).toBe('fr-FR')
    expect(document.title).toBe(model.messages['meta.title'])
  })

  it('does not scan an empty search and keeps unavailable products out of the basket', async () => {
    const { container, model } = renderCatalog(undefined, 0)
    const search = await screen.findByLabelText(model.messages['catalog.searchLabel'])

    fireEvent.keyDown(search, { key: 'Enter' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })

    expect(onScan).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Daybreak Coffee Beans/ })).toHaveProperty('disabled', true)

    const image = container.querySelector('.product-image img')
    if (!image) throw new Error('Expected the product image to render')
    fireEvent.error(image)
    expect(image.classList.contains('is-missing')).toBe(true)
  })

  it('shows an empty state when filtering finds no products', async () => {
    const { model } = renderCatalog()
    const search = await screen.findByLabelText(model.messages['catalog.searchLabel'])

    fireEvent.change(search, { target: { value: 'no matching product' } })

    expect(await screen.findByRole('heading', { name: 'No matching products' })).toBeTruthy()
  })
})
