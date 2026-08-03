import type { FiltersData } from "@/types/filters"
import type { Provider } from "@/types/provider"

const API_URL = import.meta.env.VITE_API_URL || "https://mytonprovider.org/api/v1"
const PAGE_LIMIT = 200
const MAX_PROVIDERS = 5000

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, path: string) {
    super(`${path} failed with ${status}`)
    this.name = "ApiError"
    this.status = status
  }
}

const request = async (path: string, init: RequestInit): Promise<unknown> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
  })

  if (!response.ok) {
    throw new ApiError(response.status, `${init.method ?? "GET"} ${path}`)
  }

  return response.json()
}

const pageOf = (data: unknown): unknown[] => {
  if (typeof data !== "object" || data === null || !("providers" in data)) {
    throw new Error("unexpected providers response shape")
  }

  const list = data.providers
  if (list === null) return []
  if (!Array.isArray(list)) {
    throw new Error("unexpected providers response shape")
  }

  return list
}

const isProvider = (item: unknown): item is Provider =>
  typeof item === "object" && item !== null && typeof (item as { pubkey?: unknown }).pubkey === "string"


export const fetchProviders = async (filters: FiltersData, signal: AbortSignal): Promise<Provider[]> => {
  const providers: Provider[] = []
  let offset = 0

  for (;;) {
    const data = await request("/providers/search", {
      method: "POST",
      signal,
      body: JSON.stringify({ filters, exact: [], limit: PAGE_LIMIT, offset }),
    })

    const page = pageOf(data)
    offset += page.length
    providers.push(...page.filter(isProvider))

    if (page.length < PAGE_LIMIT || offset >= MAX_PROVIDERS) {
      return providers
    }
  }
}
