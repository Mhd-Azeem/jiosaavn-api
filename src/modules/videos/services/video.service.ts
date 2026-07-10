import type { Bindings } from '#common/types'

const YOUTUBE_SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search'

interface YouTubeSearchResponse {
  items?: {
    id?: { videoId?: string }
    snippet?: {
      title?: string
      thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } }
    }
  }[]
  error?: { message?: string }
}

export interface VideoResult {
  videoId: string
  title: string
  thumbnailUrl: string | null
}

export class VideoService {
  public async searchVideo(env: Bindings, query: string): Promise<VideoResult> {
    if (!env.YOUTUBE_API_KEY) {
      throw new Error('Video search is not configured on this Worker (missing YOUTUBE_API_KEY).')
    }

    const url = new URL(YOUTUBE_SEARCH_ENDPOINT)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('maxResults', '1')
    url.searchParams.set('videoEmbeddable', 'true')
    url.searchParams.set('q', query)
    url.searchParams.set('key', env.YOUTUBE_API_KEY)

    const response = await fetch(url.toString())

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as YouTubeSearchResponse | null
      throw new Error(body?.error?.message || `YouTube Data API responded with HTTP ${response.status}`)
    }

    const json = (await response.json()) as YouTubeSearchResponse
    const item = json.items?.[0]
    const videoId = item?.id?.videoId

    if (!videoId) {
      throw new Error('No matching video found')
    }

    return {
      videoId,
      title: item?.snippet?.title ?? query,
      thumbnailUrl: item?.snippet?.thumbnails?.high?.url ?? item?.snippet?.thumbnails?.medium?.url ?? null
    }
  }
}
