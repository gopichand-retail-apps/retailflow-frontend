import { z } from 'zod'
import type { ContentModel } from './content-schema'

export function dataString(model: ContentModel, key: string): string {
  const value = model.data[key]
  if (typeof value !== 'string') throw new Error(`CONTENT_DATA_INVALID:${key}`)
  return value
}

export function dataStringRecord(model: ContentModel, key: string): Record<string, string> {
  const parsed = z.record(z.string(), z.string()).safeParse(model.data[key])
  if (!parsed.success) throw new Error(`CONTENT_DATA_INVALID:${key}`)
  return parsed.data
}

export function dataStringAt(model: ContentModel, key: string, itemKey: string, field: string): string {
  const record = z.record(z.string(), z.unknown()).safeParse(model.data[key])
  const item = record.success ? z.record(z.string(), z.unknown()).safeParse(record.data[itemKey]) : null
  const value = item?.success ? item.data[field] : undefined
  if (typeof value !== 'string') {
    throw new Error(`CONTENT_DATA_INVALID:${key}.${itemKey}.${field}`)
  }
  return value
}
