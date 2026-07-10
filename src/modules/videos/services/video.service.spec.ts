import { VideoService } from '#modules/videos/services'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('VideoService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when YOUTUBE_API_KEY is missing', async () => {
    const videoService = new VideoService()

    await expect(videoService.searchVideo({}, 'Believer Imagine Dragons')).rejects.toThrow(/not configured/)
  })

  it('returns the first matching video from a successful YouTube response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: { videoId: 'dQw4w9WgXcQ' },
              snippet: {
                title: 'Believer (Official Music Video)',
                thumbnails: { high: { url: 'https://example.com/high.jpg' } }
              }
            }
          ]
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const videoService = new VideoService()
    const result = await videoService.searchVideo({ YOUTUBE_API_KEY: 'key' }, 'Believer Imagine Dragons')

    expect(result).toEqual({
      videoId: 'dQw4w9WgXcQ',
      title: 'Believer (Official Music Video)',
      thumbnailUrl: 'https://example.com/high.jpg'
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('key=key'))
  })

  it('throws when no items are returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 })))

    const videoService = new VideoService()

    await expect(videoService.searchVideo({ YOUTUBE_API_KEY: 'key' }, 'nonexistent')).rejects.toThrow(
      'No matching video found'
    )
  })

  it('throws with the API error message when YouTube returns a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'API key not valid' } }), {
          status: 400
        })
      )
    )

    const videoService = new VideoService()

    await expect(videoService.searchVideo({ YOUTUBE_API_KEY: 'bad' }, 'query')).rejects.toThrow('API key not valid')
  })
})
