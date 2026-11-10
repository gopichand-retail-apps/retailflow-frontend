import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
}))

vi.mock('react-dom/client', () => ({
  createRoot: mocks.createRoot,
}))

vi.mock('./App.tsx', () => ({
  default: () => null,
}))

vi.mock('./content', () => ({
  ContentProvider: ({ children }: { children: unknown }) => children,
}))

describe('application bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
    mocks.createRoot.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('mounts the React application into the configured root element', async () => {
    const rootElement = document.createElement('div')
    rootElement.id = 'root'
    document.body.append(rootElement)
    const render = vi.fn()
    mocks.createRoot.mockReturnValue({ render })

    await import('./main')

    expect(mocks.createRoot).toHaveBeenCalledWith(rootElement)
    expect(render).toHaveBeenCalledOnce()
  })

  it('fails clearly when the HTML root is missing', async () => {
    await expect(import('./main')).rejects.toThrow('APP_ROOT_MISSING')
    expect(mocks.createRoot).not.toHaveBeenCalled()
  })
})
