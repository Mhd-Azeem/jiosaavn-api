import type { Bindings } from '#common/types'
import type { Context, MiddlewareHandler, Next } from 'hono'

export interface CacheOptions {
  /** Seconds a cached response is served with no revalidation at all. */
  freshTtlSeconds: number
  /** Extra seconds beyond freshTtlSeconds during which a stale copy is still served instantly
   *  while a background refresh (stale-while-revalidate) updates the cache for the next request.
   *  Defaults to freshTtlSeconds. */
  staleTtlSeconds?: number
  /** Also persist in Workers KV so the response survives Cache API misses (different edge PoP,
   *  evicted entry). Only enable for low-churn, high-value routes - the Workers Free plan caps KV
   *  to ~1,000 writes/day, so this is intentionally opt-in rather than applied everywhere. */
  useKv?: boolean
}

interface KvEntry {
  body: string
  cachedAtMs: number
}

const CACHED_AT_HEADER = 'X-Cached-At'
const CACHE_STATUS_HEADER = 'X-Cache'

const kvKeyFor = (url: string): string => `cache:${url}`

const withCacheStatus = (response: Response, status: string): Response => {
  const headers = new Headers(response.headers)
  headers.set(CACHE_STATUS_HEADER, status)
  return new Response(response.body, { status: response.status, headers })
}

// `c.executionCtx` throws when the app is served without a real ExecutionContext - true on
// Cloudflare Workers, but this codebase also supports running under plain Bun (`bun run dev`,
// Docker) and Vercel, none of which provide one. Falling back to awaiting the work inline keeps
// every deployment target correct; only Workers gets the non-blocking "respond now, refresh
// later" benefit.
const runInBackground = async (c: Context, work: () => Promise<void>): Promise<void> => {
  try {
    c.executionCtx.waitUntil(work())
  } catch {
    await work()
  }
}

// Prevents a burst of concurrent stale-cache hits for the same URL from each independently
// re-running the handler and re-writing the (optional) KV entry - only the first schedules a
// revalidation; the rest just serve their own stale response immediately, which is correct SWR
// behavior since one in-flight revalidation is enough to refresh the shared cache for everyone.
const revalidationsInFlight = new Set<string>()

const scheduleRevalidation = (c: Context, next: Next, dedupeKey: string, storeInCaches: () => Promise<void>) => {
  if (revalidationsInFlight.has(dedupeKey)) return
  revalidationsInFlight.add(dedupeKey)
  runInBackground(c, async () => {
    try {
      await next()
      await storeInCaches()
    } finally {
      revalidationsInFlight.delete(dedupeKey)
    }
  })
}

/**
 * GET-only response cache for Cloudflare Workers, layered as:
 *   1. Edge Cache API (`caches.default`) - always used, free, per-PoP, no quota.
 *   2. Workers KV (optional, `useKv`) - longer-lived and globally replicated, used only for
 *      routes worth the write-quota cost (see CacheOptions.useKv).
 *
 * Implements stale-while-revalidate: within `freshTtlSeconds` the cached response is returned
 * untouched; within the following `staleTtlSeconds` window it's still served instantly but a
 * background refetch is kicked off so the *next* request gets fresh data; once fully expired the
 * request blocks on a real refetch, same as a cold cache. User-specific routes (favorites,
 * history, auth) must never be wrapped with this - it has no notion of identity and would leak
 * one user's response to another.
 */
export const cache = (options: CacheOptions): MiddlewareHandler => {
  const { freshTtlSeconds, staleTtlSeconds = freshTtlSeconds, useKv = false } = options

  return async (c, next) => {
    if (c.req.method !== 'GET') {
      await next()
      return
    }

    const cacheKey = new Request(c.req.url, { method: 'GET' })
    // caches.open('default') is the portable spelling of Workers' caches.default - avoids a type
    // conflict between the DOM lib's CacheStorage (needed elsewhere in this project) and the
    // Workers-specific CacheStorage augmentation, since both declare `open()`.
    const edgeCache = await caches.open('default')

    const storeInCaches = async () => {
      const res = c.res
      if (!res.ok) return

      const body = await res.clone().text()
      const cachedAtMs = Date.now()
      const headers = new Headers(res.headers)
      headers.set('Cache-Control', `public, max-age=${freshTtlSeconds}, stale-while-revalidate=${staleTtlSeconds}`)
      headers.set(CACHED_AT_HEADER, cachedAtMs.toString())

      await edgeCache.put(cacheKey, new Response(body, { status: res.status, headers }))

      if (useKv) {
        const kv = (c.env as Bindings).CACHE_KV
        if (kv) {
          const entry: KvEntry = { body, cachedAtMs }
          await kv.put(kvKeyFor(c.req.url), JSON.stringify(entry), {
            expirationTtl: freshTtlSeconds + staleTtlSeconds
          })
        }
      }

      c.res = new Response(body, { status: res.status, headers })
    }

    const edgeHit = await edgeCache.match(cacheKey)
    if (edgeHit) {
      const cachedAtMs = Number(edgeHit.headers.get(CACHED_AT_HEADER) ?? 0)
      const ageSeconds = (Date.now() - cachedAtMs) / 1000

      if (ageSeconds < freshTtlSeconds) {
        c.res = withCacheStatus(edgeHit, 'HIT')
        return
      }

      if (ageSeconds < freshTtlSeconds + staleTtlSeconds) {
        c.res = withCacheStatus(edgeHit, 'STALE')
        scheduleRevalidation(c, next, c.req.url, storeInCaches)
        return
      }
      // fully expired - fall through to a synchronous refetch below
    } else if (useKv) {
      const kv = (c.env as Bindings).CACHE_KV
      const kvRaw = kv ? await kv.get(kvKeyFor(c.req.url)) : null
      const kvEntry = kvRaw ? (JSON.parse(kvRaw) as KvEntry) : null

      if (kvEntry) {
        // KV's own expirationTtl (freshTtlSeconds + staleTtlSeconds) guarantees this read can
        // never be older than that window, but it can be anywhere inside it - so the *real*
        // cachedAtMs is preserved and used to compute freshness, rather than stamping "now" and
        // silently doubling how long stale data can go unrefreshed.
        const ageSeconds = (Date.now() - kvEntry.cachedAtMs) / 1000
        const headers = new Headers({
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${freshTtlSeconds}, stale-while-revalidate=${staleTtlSeconds}`,
          [CACHED_AT_HEADER]: kvEntry.cachedAtMs.toString(),
          [CACHE_STATUS_HEADER]: ageSeconds < freshTtlSeconds ? 'KV-HIT' : 'KV-STALE'
        })
        const kvResponse = new Response(kvEntry.body, { status: 200, headers })

        await runInBackground(c, () => edgeCache.put(cacheKey, kvResponse.clone()))
        if (ageSeconds >= freshTtlSeconds) {
          scheduleRevalidation(c, next, c.req.url, storeInCaches)
        }

        c.res = kvResponse
        return
      }
    }

    await next()
    await storeInCaches()
  }
}
