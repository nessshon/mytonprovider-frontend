import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { FiltersData, FiltersRange } from "@/types/filters"
import type { Provider } from "@/types/provider"
import type { ProviderDetail, SortDirection, SortField } from "@/types/model"
import { ApiError, fetchProviders } from "./api"
import { collectHashes, deriveFiltersRange, matchesQuery, sortProviders, toDetail, toRow } from "./model"
import { isPristine, type OptionSource } from "./filters"

export const PAGE_SIZE = 10
const COUNT_DELAY_MS = 250
const FRESH_FOR_MS = 120_000
const REMEMBERED_ANSWERS = 16

const answers = new Map<string, { providers: Provider[]; at: number }>()

const answerKey = (filters: FiltersData): string =>
  JSON.stringify(Object.entries(filters).sort(([left], [right]) => left.localeCompare(right)))

const rememberedAnswer = (filters: FiltersData): Provider[] | null => {
  const remembered = answers.get(answerKey(filters))
  return remembered && Date.now() - remembered.at < FRESH_FOR_MS ? remembered.providers : null
}

const loadProviders = async (filters: FiltersData, signal: AbortSignal): Promise<Provider[]> => {
  const key = answerKey(filters)
  const remembered = rememberedAnswer(filters)
  if (remembered) return remembered

  const providers = await fetchProviders(filters, signal)
  answers.delete(key)
  answers.set(key, { providers, at: Date.now() })
  for (const stale of answers.keys()) {
    if (answers.size <= REMEMBERED_ANSWERS) break
    answers.delete(stale)
  }
  return providers
}

interface Snapshot {
  providers: Provider[]
  range: FiltersRange | null
  hashes: { storage: string[]; provider: string[] }
  fetchedAt: number
}

export const NOTHING_LOADED: Snapshot = {
  providers: [],
  range: null,
  hashes: { storage: [], provider: [] },
  fetchedAt: 0,
}

export const nextSnapshot = (
  current: Snapshot,
  providers: Provider[],
  filters: FiltersData,
  now: number,
): Snapshot => ({
  providers,
  range: isPristine(filters) ? deriveFiltersRange(providers, now) : current.range,
  hashes: collectHashes(providers, current.hashes),
  fetchedAt: now,
})

export const useCatalog = (filters: FiltersData, favorites: string[]) => {
  const { t } = useTranslation()

  const [snapshot, setSnapshot] = useState<Snapshot>(NOTHING_LOADED)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<{ status: number | null } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [query, setQueryValue] = useState("")
  const [sortField, setSortField] = useState<SortField>("rating")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [limit, setLimit] = useState(PAGE_SIZE)
  const loadedAt = useRef(0)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setFailure(null)

    loadProviders(filters, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return
        const now = Math.floor(Date.now() / 1000)
        loadedAt.current = Date.now()
        setSnapshot((current) => nextSnapshot(current, loaded, filters, now))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFailure({ status: error instanceof ApiError ? error.status : null })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [filters, reloadToken])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - loadedAt.current < FRESH_FOR_MS) return
      setReloadToken((current) => current + 1)
    }

    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [filters])

  const sorted = useMemo(() => {
    const matched = snapshot.providers.filter((provider) => matchesQuery(provider, query))
    return sortProviders(matched, sortField, sortDirection)
  }, [snapshot.providers, query, sortField, sortDirection])

  const rows = useMemo(() => sorted.slice(0, limit).map((provider) => toRow(provider, t)), [sorted, limit, t])

  const pinned = useMemo(
    () => sorted.filter((provider) => favorites.includes(provider.pubkey)).map((provider) => toRow(provider, t)),
    [sorted, favorites, t],
  )

  const options = useMemo<Record<OptionSource, string[]>>(
    () => ({
      locations: snapshot.range?.locations ?? [],
      storageHashes: snapshot.hashes.storage,
      providerHashes: snapshot.hashes.provider,
    }),
    [snapshot.range, snapshot.hashes],
  )

  const detailFor = useCallback(
    (pubkey: string): ProviderDetail | null => {
      const provider = snapshot.providers.find((item) => item.pubkey === pubkey)
      return provider ? toDetail(provider, snapshot.fetchedAt, t) : null
    },
    [snapshot.providers, snapshot.fetchedAt, t],
  )

  const setQuery = useCallback((next: string) => {
    setQueryValue(next)
    setLimit(PAGE_SIZE)
  }, [])

  const toggleSort = (field: SortField) => {
    if (field !== sortField) {
      setSortField(field)
      setSortDirection("desc")
      return
    }
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
  }

  return {
    rows,
    pinned,
    total: sorted.length,
    loading,
    showSkeleton: loading && snapshot.providers.length === 0,
    failure,
    range: snapshot.range,
    options,
    query,
    setQuery,
    sortField,
    sortDirection,
    toggleSort,
    loadMore: () => setLimit((current) => current + PAGE_SIZE),
    retry: () => setReloadToken((current) => current + 1),
    detailFor,
  }
}

interface MatchCountInput {
  draft: FiltersData
  applied: FiltersData
  appliedTotal: number | null
  query: string
  active: boolean
}

export const useMatchCount = ({ draft, applied, appliedTotal, query, active }: MatchCountInput) => {
  const [total, setTotal] = useState<number | null>(appliedTotal)
  const [counting, setCounting] = useState(false)

  useEffect(() => {
    if (!active || draft === applied) {
      setTotal(appliedTotal)
      setCounting(false)
      return
    }

    const known = rememberedAnswer(draft)
    if (known) {
      setTotal(known.filter((provider) => matchesQuery(provider, query)).length)
      setCounting(false)
      return
    }

    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      setCounting(true)
      loadProviders(draft, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return
          setTotal(found.filter((provider) => matchesQuery(provider, query)).length)
        })
        .catch(() => {
          if (!controller.signal.aborted) setTotal(null)
        })
        .finally(() => {
          if (!controller.signal.aborted) setCounting(false)
        })
    }, COUNT_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [draft, applied, appliedTotal, query, active])

  return { total, counting }
}
