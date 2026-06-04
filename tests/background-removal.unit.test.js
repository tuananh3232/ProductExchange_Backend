// Unit test cho background-removal.service.js
// File kết thúc .unit.test.js → jest.setup-after-env.js bỏ qua connect DB

jest.unstable_mockModule('form-data', () => {
  const MockFormData = jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data; boundary=xxx' }),
  }))
  return { default: MockFormData }
})

jest.unstable_mockModule('node-fetch', () => ({
  default: jest.fn(),
}))

let removeBackground
let mockFetch

beforeAll(async () => {
  ;({ removeBackground } = await import('../src/services/visual-assets/background-removal.service.js'))
  mockFetch = (await import('node-fetch')).default
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('removeBackground()', () => {
  const fakeBuffer = Buffer.from('fake-image-data')

  // ─── manual ────────────────────────────────────────────────────────────────

  describe('provider: manual', () => {
    it('returns the same buffer with mimeType image/png', async () => {
      const result = await removeBackground({ buffer: fakeBuffer, provider: 'manual' })
      expect(result.buffer).toBe(fakeBuffer)
      expect(result.mimeType).toBe('image/png')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // ─── unsupported ────────────────────────────────────────────────────────────

  describe('provider: unsupported', () => {
    it('throws 400 UNSUPPORTED_BG_REMOVAL_PROVIDER', async () => {
      await expect(removeBackground({ buffer: fakeBuffer, provider: 'magic_ai' })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'UNSUPPORTED_BG_REMOVAL_PROVIDER',
      })
    })
  })

  // ─── remove_bg ──────────────────────────────────────────────────────────────

  describe('provider: remove_bg', () => {
    let savedKey

    beforeEach(() => {
      savedKey = process.env.REMOVE_BG_API_KEY
    })

    afterEach(() => {
      if (savedKey === undefined) {
        delete process.env.REMOVE_BG_API_KEY
      } else {
        process.env.REMOVE_BG_API_KEY = savedKey
      }
    })

    it('throws 503 PROVIDER_NOT_CONFIGURED when key is missing', async () => {
      delete process.env.REMOVE_BG_API_KEY
      await expect(removeBackground({ buffer: fakeBuffer, provider: 'remove_bg' })).rejects.toMatchObject({
        statusCode: 503,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('calls remove.bg API and returns processed buffer on success', async () => {
      process.env.REMOVE_BG_API_KEY = 'test-api-key-abc'
      const outputBuffer = Buffer.from('bg-removed-result')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(outputBuffer.buffer),
      })

      const result = await removeBackground({ buffer: fakeBuffer, provider: 'remove_bg' })

      expect(result.mimeType).toBe('image/png')
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.remove.bg/v1.0/removebg',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Api-Key': 'test-api-key-abc' }),
        })
      )
    })

    it('throws 502 BG_REMOVAL_FAILED when API returns error response', async () => {
      process.env.REMOVE_BG_API_KEY = 'test-api-key-abc'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('Insufficient credits'),
      })

      await expect(removeBackground({ buffer: fakeBuffer, provider: 'remove_bg' })).rejects.toMatchObject({
        statusCode: 502,
        errorCode: 'BG_REMOVAL_FAILED',
      })
    })
  })

  // ─── clipdrop ───────────────────────────────────────────────────────────────

  describe('provider: clipdrop', () => {
    let savedKey

    beforeEach(() => {
      savedKey = process.env.CLIPDROP_API_KEY
    })

    afterEach(() => {
      if (savedKey === undefined) {
        delete process.env.CLIPDROP_API_KEY
      } else {
        process.env.CLIPDROP_API_KEY = savedKey
      }
    })

    it('throws 503 PROVIDER_NOT_CONFIGURED when key is missing', async () => {
      delete process.env.CLIPDROP_API_KEY
      await expect(removeBackground({ buffer: fakeBuffer, provider: 'clipdrop' })).rejects.toMatchObject({
        statusCode: 503,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('calls Clipdrop API and returns processed buffer on success', async () => {
      process.env.CLIPDROP_API_KEY = 'clipdrop-key-xyz'
      const outputBuffer = Buffer.from('clipdrop-result')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(outputBuffer.buffer),
      })

      const result = await removeBackground({ buffer: fakeBuffer, provider: 'clipdrop' })

      expect(result.mimeType).toBe('image/png')
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://clipdrop-api.co/remove-background/v1',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-api-key': 'clipdrop-key-xyz' }),
        })
      )
    })

    it('throws 502 BG_REMOVAL_FAILED when API returns error response', async () => {
      process.env.CLIPDROP_API_KEY = 'clipdrop-key-xyz'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('Quota exceeded'),
      })

      await expect(removeBackground({ buffer: fakeBuffer, provider: 'clipdrop' })).rejects.toMatchObject({
        statusCode: 502,
        errorCode: 'BG_REMOVAL_FAILED',
      })
    })
  })
})
