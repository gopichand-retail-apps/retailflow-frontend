import { describe, expect, it } from 'vitest'
import type { Product } from '../api.js'
import { calculateCartTotals, formatMoney, parseMoneyInput } from './money.js'

describe('checkout money preview', () => {
  it('matches the server discount, tax and rounding rules', () => {
    const product: Product = {
      id: 'coffee',
      sku: 'PAN-2041',
      barcode: '850000000001',
      name: 'Daybreak Coffee Beans',
      description: '12 oz bag',
      category: 'Pantry',
      unitPriceMinor: 1299,
      stockQuantity: 18,
      lowStockThreshold: 6,
      imageUrl: '/images/coffee-beans.webp',
    }

    expect(calculateCartTotals([{ product, quantity: 2 }], 1000, 825)).toEqual({
      subtotalMinor: 2598,
      discountMinor: 260,
      taxMinor: 193,
      totalMinor: 2531,
    })
  })

  it('parses only plain dollar amounts and formats minor units', () => {
    expect(parseMoneyInput('12.34')).toBe(1234)
    expect(parseMoneyInput('12.345')).toBeNull()
    expect(parseMoneyInput('9999999.99')).toBe(999999999)
    expect(parseMoneyInput('10000000')).toBeNull()
    expect(formatMoney(1234)).toBe('$12.34')
  })
})
