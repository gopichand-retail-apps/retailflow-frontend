import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentProvider } from './content'
import { useContent } from './content-context'
import type { ContentModel, Translate } from './content-schema'

function makeModel(locale: string, title: string, description: string, heading: string): ContentModel {
  return {
    version: 1,
    appId: 'retailflow',
    locale,
    messages: {
      'meta.title': title,
      'meta.description': description,
      'screen.heading': heading,
    },
    data: {},
  }
}

function ContentProbe() {
  const { t } = useContent()
  return <h1>{t('screen.heading')}</h1>
}

describe('RetailFlow content model', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.documentElement.lang = ''
    document.title = ''
  })

  it('replaces rendered copy and document metadata from a fresh model', async () => {
    const description = document.createElement('meta')
    description.name = 'description'
    document.head.append(description)

    const englishModel = makeModel('en-US', 'RetailFlow demo', 'Local retail demo', 'Store operations')
    const frenchModel = makeModel(
      'fr-CA',
      'RetailFlow | D\u00e9mo',
      'D\u00e9mo locale de commerce',
      'Op\u00e9rations du magasin',
    )
    let activeModel = englishModel
    const fetchModel = vi.fn(async () => ({ ok: true, json: async () => activeModel }))
    vi.stubGlobal('fetch', fetchModel)

    const renderModel = () =>
      render(
        <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
          <ContentProbe />
        </ContentProvider>,
      )

    const englishView = renderModel()
    expect(await screen.findByRole('heading', { name: 'Store operations' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('en-US')
    expect(document.title).toBe('RetailFlow demo')
    expect(description.content).toBe('Local retail demo')

    englishView.unmount()
    activeModel = frenchModel
    renderModel()

    expect(await screen.findByRole('heading', { name: 'Op\u00e9rations du magasin' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('fr-CA')
    expect(document.title).toBe('RetailFlow | D\u00e9mo')
    expect(description.content).toBe('D\u00e9mo locale de commerce')
    expect(fetchModel).toHaveBeenNthCalledWith(
      1,
      '/retailflow-model.json',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
    expect(fetchModel).toHaveBeenCalledTimes(2)
  })

  it('creates missing metadata and rejects unresolved message keys or placeholders', async () => {
    let translate: Translate | undefined
    function TranslationCapture() {
      const { t } = useContent()
      translate = t
      return <h1>{t('screen.heading')}</h1>
    }

    document.querySelector('meta[name="description"]')?.remove()
    const model = makeModel('en-US', 'RetailFlow demo', 'Local retail demo', 'Store operations')
    model.messages.greeting = 'Hello {{name}}'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => model,
      }),
    )

    render(
      <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
        <TranslationCapture />
      </ContentProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Store operations' })).toBeTruthy()
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Local retail demo')
    expect(translate?.('greeting', { name: 'Alex' })).toBe('Hello Alex')
    expect(() => translate?.('missing.key')).toThrow('CONTENT_KEY_MISSING:missing.key')
    expect(() => translate?.('greeting')).toThrow('CONTENT_VALUE_MISSING:name')
  })

  it.each([
    ['invalid schema', { version: 2, appId: 'retailflow', locale: 'en-US', messages: {}, data: {} }],
    ['wrong application', { ...makeModel('en-US', 'Title', 'Description', 'Heading'), appId: 'other-app' }],
    [
      'missing title',
      { ...makeModel('en-US', 'Title', 'Description', 'Heading'), messages: { 'meta.description': 'Description' } },
    ],
    [
      'missing description',
      { ...makeModel('en-US', 'Title', 'Description', 'Heading'), messages: { 'meta.title': 'Title' } },
    ],
  ])('fails closed for a content model with %s', async (_caseName, payload) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      }),
    )

    render(
      <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
        <ContentProbe />
      </ContentProvider>,
    )

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Store operations')).toBeNull()
  })

  it('does not show an error state after an aborted content request', async () => {
    const fetchModel = vi.fn(
      (_url: string, options?: RequestInit) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    vi.stubGlobal('fetch', fetchModel)

    const rendered = render(
      <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
        <ContentProbe />
      </ContentProvider>,
    )

    await screen.findByRole('status')
    rendered.unmount()
    await Promise.resolve()
    await Promise.resolve()

    expect(fetchModel.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })
})
