export interface Bindings {
  CF_API_TOKEN?: string
  CF_ACCOUNT_ID?: string
  DAILY_REQUEST_LIMIT?: string
  // Secondary, longer-lived cache layer for low-churn detail responses (song/album/artist/playlist).
  // Optional because local/dev environments and PR previews may not have a namespace bound yet -
  // the cache middleware falls back to Cache-API-only behavior when it's undefined.
  CACHE_KV?: KVNamespace
}
