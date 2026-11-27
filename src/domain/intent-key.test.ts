import { describe, expect, it } from 'vitest'
import { createIntentKeyHolder } from './intent-key'

function sequentialKeys() {
  let next = 0
  return () => `key-${(next += 1)}`
}

describe('intent key holder', () => {
  it('reuses one key for every retry of the same confirmed payload', () => {
    const holder = createIntentKeyHolder(sequentialKeys())

    const first = holder.acquire('payload-a')

    expect(holder.acquire('payload-a')).toBe(first)
    expect(holder.acquire('payload-a')).toBe(first)
  })

  it('replaces the key when the payload changes', () => {
    const holder = createIntentKeyHolder(sequentialKeys())

    const first = holder.acquire('payload-a')
    const second = holder.acquire('payload-b')

    expect(second).not.toBe(first)
    expect(holder.acquire('payload-b')).toBe(second)
  })

  it('discards the key after a confirmed result, sign-out or abandoned form', () => {
    const holder = createIntentKeyHolder(sequentialKeys())

    const first = holder.acquire('payload-a')
    holder.release()

    expect(holder.acquire('payload-a')).not.toBe(first)
  })

  it('reports whether an unresolved intent exists for a payload', () => {
    const holder = createIntentKeyHolder(sequentialKeys())
    expect(holder.isPending('payload-a')).toBe(false)

    holder.acquire('payload-a')

    expect(holder.isPending('payload-a')).toBe(true)
    expect(holder.isPending('payload-b')).toBe(false)
    holder.release()
    expect(holder.isPending('payload-a')).toBe(false)
  })

  it('generates unguessable keys of an accepted length by default', () => {
    const holder = createIntentKeyHolder()

    const key = holder.acquire('payload-a')

    expect(key).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
    holder.release()
    expect(holder.acquire('payload-a')).not.toBe(key)
  })
})
