import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { UsageService } from '#modules/usage/services'
import type { Bindings, Routes } from '#common/types'

export class UsageController implements Routes {
  public controller: OpenAPIHono
  private usageService: UsageService

  constructor() {
    this.controller = new OpenAPIHono()
    this.usageService = new UsageService()
  }

  public initRoutes() {
    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/usage',
        tags: ['Usage'],
        summary: "Today's Cloudflare Workers request usage",
        description:
          "Returns today's request count for this Worker, read live from Cloudflare's own Analytics API, alongside the configured daily plan limit. Requires CF_API_TOKEN and CF_ACCOUNT_ID to be configured on the Worker.",
        operationId: 'getUsage',
        responses: {
          200: {
            description: 'Successful response with usage stats',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  data: z.object({
                    used: z.number().openapi({ description: 'Requests served today', example: 1234 }),
                    limit: z.number().openapi({ description: 'Configured daily request limit', example: 100_000 }),
                    date: z.string().openapi({ description: 'UTC date these numbers cover', example: '2026-07-08' })
                  })
                })
              }
            }
          },
          503: {
            description: 'Usage tracking is not configured or Cloudflare Analytics is unreachable',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  message: z.string()
                })
              }
            }
          }
        }
      }),
      async (ctx) => {
        try {
          const result = await this.usageService.getTodayUsage(ctx.env as Bindings)
          return ctx.json({ success: true, data: result }, 200)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch usage stats'
          return ctx.json({ success: false, message }, 503)
        }
      }
    )
  }
}
