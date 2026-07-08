import type { Bindings } from '#common/types'

const CLOUDFLARE_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'
const DEFAULT_DAILY_LIMIT = 100_000
const WORKER_SCRIPT_NAME = 'jiosaavn-api'

const WORKER_USAGE_QUERY = `
  query WorkerUsage($accountTag: string!, $start: Time!, $end: Time!, $scriptName: string!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        workersInvocationsAdaptive(
          filter: { datetime_geq: $start, datetime_leq: $end, scriptName: $scriptName }
          limit: 1
          orderBy: [sum_requests_DESC]
        ) {
          sum { requests }
        }
      }
    }
  }
`

interface CloudflareGraphQLResponse {
  data?: {
    viewer?: {
      accounts?: { workersInvocationsAdaptive?: { sum: { requests: number } }[] }[]
    }
  }
  errors?: { message: string }[]
}

export interface WorkersUsage {
  used: number
  limit: number
  date: string
}

export class UsageService {
  public async getTodayUsage(env: Bindings): Promise<WorkersUsage> {
    const limit = env.DAILY_REQUEST_LIMIT ? Number(env.DAILY_REQUEST_LIMIT) : DEFAULT_DAILY_LIMIT
    const date = new Date().toISOString().slice(0, 10)

    if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
      throw new Error('Usage tracking is not configured on this Worker (missing CF_API_TOKEN or CF_ACCOUNT_ID).')
    }

    const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: WORKER_USAGE_QUERY,
        variables: {
          accountTag: env.CF_ACCOUNT_ID,
          start: `${date}T00:00:00Z`,
          end: new Date().toISOString(),
          scriptName: WORKER_SCRIPT_NAME
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Cloudflare Analytics API responded with HTTP ${response.status}`)
    }

    const json = (await response.json()) as CloudflareGraphQLResponse

    if (json.errors?.length) {
      throw new Error(json.errors.map((error) => error.message).join('; '))
    }

    const used = json.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0]?.sum.requests ?? 0

    return { used, limit, date }
  }
}
