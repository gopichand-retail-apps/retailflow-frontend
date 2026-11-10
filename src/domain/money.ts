import type { Product } from '../api.js'

export interface CartEntry {
  product: Product
  quantity: number
}

export interface CartTotals {
  subtotalMinor: number
  discountMinor: number
  taxMinor: number
  totalMinor: number
}

const BASIS_POINTS = 10_000n

function applyBasisPoints(amountMinor: number, basisPoints: number): number {
  const amount = BigInt(amountMinor)
  const rate = BigInt(basisPoints)
  return Number((amount * rate + BASIS_POINTS / 2n) / BASIS_POINTS)
}

export function calculateCartTotals(
  entries: CartEntry[],
  discountBasisPoints: number,
  taxBasisPoints: number,
): CartTotals {
  return entries.reduce<CartTotals>(
    (result, entry) => {
      const subtotal = entry.product.unitPriceMinor * entry.quantity
      const discount = applyBasisPoints(subtotal, discountBasisPoints)
      const taxable = subtotal - discount
      const tax = applyBasisPoints(taxable, taxBasisPoints)

      return {
        subtotalMinor: result.subtotalMinor + subtotal,
        discountMinor: result.discountMinor + discount,
        taxMinor: result.taxMinor + tax,
        totalMinor: result.totalMinor + taxable + tax,
      }
    },
    { subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0 },
  )
}

export function formatMoney(amountMinor: number, locale = 'en-US', currency = 'USD'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 100)
}

export function parseMoneyInput(input: string): number | null {
  if (!/^\d{1,7}(?:\.\d{0,2})?$/.test(input)) {
    return null
  }

  const [whole = '0', fraction = ''] = input.split('.')
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return minor
}

export function formatMoneyInput(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2)
}
