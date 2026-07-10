export interface Bindings {
  CF_API_TOKEN?: string
  CF_ACCOUNT_ID?: string
  DAILY_REQUEST_LIMIT?: string
  // Secondary, longer-lived cache layer for low-churn detail responses (song/album/artist/playlist).
  // Optional because local/dev environments and PR previews may not have a namespace bound yet -
  // the cache middleware falls back to Cache-API-only behavior when it's undefined.
  CACHE_KV?: KVNamespace
  // Powers GET /api/videos/search. A secret, not a var - set it with:
  //   wrangler secret put YOUTUBE_API_KEY
  // Get a key at https://console.cloud.google.com/apis/credentials after enabling "YouTube Data
  // API v3" for a project.
  YOUTUBE_API_KEY?: string
}
