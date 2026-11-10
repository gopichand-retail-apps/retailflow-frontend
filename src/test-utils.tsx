import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { ContentProvider } from './content'

const contentModel = JSON.parse(readFileSync(resolve('public/retailflow-model.json'), 'utf8')) as unknown

export function stubRetailContentModel(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => contentModel,
    }),
  )
}

export function stubNativeDialogs(): void {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    },
  })
}

export function renderWithRetailContent(children: ReactNode) {
  return render(
    <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
      {children}
    </ContentProvider>,
  )
}
