import { describe, expect, it } from 'vitest'
import type { ContentModel } from './content-schema'
import { dataString, dataStringAt, dataStringRecord } from './content-utils'

const model: ContentModel = {
  version: 1,
  appId: 'retailflow',
  locale: 'en-US',
  messages: {},
  data: {
    storeName: 'Field & Found',
    categoryLabels: { Pantry: 'Pantry' },
    productLabels: {
      coffee: { name: 'Daybreak Coffee Beans' },
    },
    invalidLabels: ['not', 'a', 'record'],
  },
}

describe('content model data accessors', () => {
  it('returns validated strings, records, and nested labels', () => {
    expect(dataString(model, 'storeName')).toBe('Field & Found')
    expect(dataStringRecord(model, 'categoryLabels')).toEqual({ Pantry: 'Pantry' })
    expect(dataStringAt(model, 'productLabels', 'coffee', 'name')).toBe('Daybreak Coffee Beans')
  })

  it('rejects missing and malformed content instead of rendering a fallback', () => {
    expect(() => dataString(model, 'missing')).toThrow('CONTENT_DATA_INVALID:missing')
    expect(() => dataString(model, 'categoryLabels')).toThrow('CONTENT_DATA_INVALID:categoryLabels')
    expect(() => dataStringRecord(model, 'invalidLabels')).toThrow('CONTENT_DATA_INVALID:invalidLabels')
    expect(() => dataStringAt(model, 'missing', 'coffee', 'name')).toThrow('CONTENT_DATA_INVALID:missing.coffee.name')
    expect(() => dataStringAt(model, 'productLabels', 'missing', 'name')).toThrow(
      'CONTENT_DATA_INVALID:productLabels.missing.name',
    )
    expect(() => dataStringAt(model, 'productLabels', 'coffee', 'missing')).toThrow(
      'CONTENT_DATA_INVALID:productLabels.coffee.missing',
    )
  })
})
