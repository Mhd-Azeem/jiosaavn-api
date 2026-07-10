import { userAgents, type Endpoints } from '#common/constants'
import type { ApiContextEnum } from '#common/enums'

type EndpointValue = (typeof Endpoints)[keyof typeof Endpoints]

interface FetchParams {
  endpoint: EndpointValue
  params: Record<string, string | number>
  context?: ApiContextEnum
}

interface FetchResponse<T> {
  data: T
  ok: Response['ok']
}

// Collapses concurrent calls for the identical upstream URL into a single in-flight fetch, so a
// burst of requests hitting this isolate for the same not-yet-cached resource (e.g. several users
// opening the same album at once) only hits JioSaavn once. Scoped to this module's lifetime, which
// spans concurrent requests handled by the same Worker isolate.
const inFlightRequests = new Map<string, Promise<FetchResponse<unknown>>>()

export const useFetch = <T>({ endpoint, params, context }: FetchParams): Promise<FetchResponse<T>> => {
  const url = new URL('https://www.jiosaavn.com/api.php')

  url.searchParams.append('__call', endpoint.toString())
  url.searchParams.append('_format', 'json')
  url.searchParams.append('_marker', '0')
  url.searchParams.append('api_version', '4')
  url.searchParams.append('ctx', context || 'web6dot0')

  Object.keys(params).forEach((key) => url.searchParams.append(key, String(params[key])))

  const dedupeKey = url.toString()
  const existing = inFlightRequests.get(dedupeKey)
  if (existing) return existing as Promise<FetchResponse<T>>

  const requestPromise = (async (): Promise<FetchResponse<T>> => {
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

    const response = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', 'User-Agent': randomUserAgent }
    })

    const data = await response.json()

    return { data: data as T, ok: response.ok }
  })()

  inFlightRequests.set(dedupeKey, requestPromise)
  // .finally() returns its own derived promise; if requestPromise rejects, that derived promise
  // rejects too. Nothing else references it, so without this .catch() it surfaces as an unhandled
  // rejection even though the caller of useFetch() handles the (separate) requestPromise it got.
  requestPromise.finally(() => inFlightRequests.delete(dedupeKey)).catch(() => {})

  return requestPromise
}
