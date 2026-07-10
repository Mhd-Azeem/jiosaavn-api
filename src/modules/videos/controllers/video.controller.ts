import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { SEARCH_CACHE_STALE_SECONDS, SEARCH_CACHE_TTL_SECONDS } from '#common/constants'
import { cache } from '#common/middleware'
import { VideoService } from '#modules/videos/services'
import type { Bindings, Routes } from '#common/types'

export class VideoController implements Routes {
  public controller: OpenAPIHono
  private videoService: VideoService

  constructor() {
    this.controller = new OpenAPIHono()
    this.videoService = new VideoService()
  }

  public initRoutes() {
    // A given result would be cacheable for as long as the detail tier (a song's matching video
    // never changes), but the query itself is client-constructed free text with effectively
    // unbounded cardinality - same shape as /search, not the bounded id/link lookups the detail
    // tier's KV layer is scoped to. Cache-API-only, same tier as search, to protect the KV
    // free-tier write quota.
    this.controller.use(
      '/videos/search',
      cache({ freshTtlSeconds: SEARCH_CACHE_TTL_SECONDS, staleTtlSeconds: SEARCH_CACHE_STALE_SECONDS })
    )

    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/videos/search',
        tags: ['Videos'],
        summary: 'Search YouTube for a matching video',
        description:
          'Searches YouTube (via the YouTube Data API v3) for a video matching the given query, typically ' +
          '"<song> <artist> official video". Requires YOUTUBE_API_KEY to be configured on the Worker.',
        operationId: 'searchVideo',
        request: {
          query: z.object({
            query: z.string().min(1).openapi({
              title: 'Search query',
              description: 'Search query, e.g. "Believer Imagine Dragons official video"',
              type: 'string',
              example: 'Believer Imagine Dragons official video'
            })
          })
        },
        responses: {
          200: {
            description: 'Successful response with a matching video',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean().openapi({ example: true }),
                  data: z.object({
                    videoId: z.string().openapi({ description: 'YouTube video ID', example: 'dQw4w9WgXcQ' }),
                    title: z.string(),
                    thumbnailUrl: z.string().nullable()
                  })
                })
              }
            }
          },
          404: { description: 'No matching video found' },
          503: { description: 'Video search is not configured on this Worker' }
        }
      }),
      async (ctx) => {
        const { query } = ctx.req.valid('query')

        try {
          const result = await this.videoService.searchVideo(ctx.env as Bindings, query)
          return ctx.json({ success: true, data: result }, 200)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to search for video'
          if (message.includes('not configured')) {
            return ctx.json({ success: false, message }, 503)
          }
          return ctx.json({ success: false, message }, 404)
        }
      }
    )
  }
}
