import { UsageService } from '#modules/usage/services'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('UsageService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when CF_API_TOKEN or CF_ACCOUNT_ID is missing', async () => {
    const usageService = new UsageService()

    await expect(usageService.getTodayUsage({})).rejects.toThrow(/not configured/)
  })

  it('returns used/limit/date from a successful Cloudflare Analytics response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            viewer: {
              accounts: [{ workersInvocationsAdaptive: [{ sum: { requests: 4321 } }] }]
            }
          }
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const usageService = new UsageService()
    const result = await usageService.getTodayUsage({
      CF_API_TOKEN: 'token',
      CF_ACCOUNT_ID: 'account',
      DAILY_REQUEST_LIMIT: '50000'
    })

    expect(result.used).toBe(4321)
    expect(result.limit).toBe(50_000)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/graphql',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws when Cloudflare returns GraphQL errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ message: 'invalid token' }] }), {
          status: 200
        })
      )
    )

    const usageService = new UsageService()

    await expect(usageService.getTodayUsage({ CF_API_TOKEN: 'bad', CF_ACCOUNT_ID: 'account' })).rejects.toThrow(
      'invalid token'
    )
  })

  it('defaults used to 0 when no rows are returned for the script', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [] }] } } }), {
          status: 200
        })
      )
    )

    const usageService = new UsageService()
    const result = await usageService.getTodayUsage({ CF_API_TOKEN: 'token', CF_ACCOUNT_ID: 'account' })

    expect(result.used).toBe(0)
    expect(result.limit).toBe(100_000)
  })
})
