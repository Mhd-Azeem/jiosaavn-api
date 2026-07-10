/** Search results change often (new releases, trending shifts) - kept short so results stay fresh. */
export const SEARCH_CACHE_TTL_SECONDS = 600 // 10 minutes
export const SEARCH_CACHE_STALE_SECONDS = 300 // +5 minutes served-stale-while-revalidating

/** Song/album/artist/playlist metadata rarely changes once published - safe to cache for a day. */
export const DETAIL_CACHE_TTL_SECONDS = 86_400 // 24 hours
export const DETAIL_CACHE_STALE_SECONDS = 3_600 // +1 hour served-stale-while-revalidating
