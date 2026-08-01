import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FiltersData, FiltersRange } from "@/types/filters"
import type { Provider } from "@/types/provider"
import type { SortDirection, SortField } from "@/types/model"
import { ApiError, fetchProviders } from "@/lib/api"
import { collectHashes, deriveFiltersRange, matchesQuery, sortProviders, toDetail, toRow } from "@/lib/model"
import { NO_FILTERS, countActiveFilters, isPristine } from "@/lib/filters"
import { FAVORITES_KEY, readStoredStrings, writeStored } from "@/lib/storage"
import { copyText, scrollToTop } from "@/lib/dom"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Filters } from "@/components/filters"
import { FilterButton } from "@/components/filter-button"
import { IconButton } from "@/components/icon-button"
import { ProviderDetails } from "@/components/provider-details"
import { ProviderList } from "@/components/provider-list"
import { Sheet } from "@/components/sheet"
import styles from "./app.module.css"

const PAGE_SIZE = 10
const COPIED_RESET_MS = 1200

type Overlay = { kind: "filters" } | { kind: "detail"; pubkey: string } | null

export const App = () => {
  const { t } = useTranslation()

  const [providers, setProviders] = useState<Provider[]>([])
  const [range, setRange] = useState<FiltersRange | null>(null)
  const [filters, setFilters] = useState<FiltersData>(NO_FILTERS)
  const [draft, setDraft] = useState<FiltersData>(NO_FILTERS)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<{ status: number | null } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [fetchedAt, setFetchedAt] = useState(0)

  const [query, setQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("rating")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [favorites, setFavorites] = useState<string[]>(() => readStoredStrings(FAVORITES_KEY))
  const [limit, setLimit] = useState(PAGE_SIZE)

  const [hashes, setHashes] = useState<{ storage: string[]; provider: string[] }>({
    storage: [],
    provider: [],
  })
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [scrolledDown, setScrolledDown] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)

  const copyTimer = useRef<number>(0)
  const footerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setFailure(null)

    fetchProviders(filters, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return
        const now = Math.floor(Date.now() / 1000)
        setProviders(loaded)
        setHashes((current) => collectHashes(loaded, current))
        setFetchedAt(now)
        setLimit(PAGE_SIZE)
        if (isPristine(filters)) setRange(deriveFiltersRange(loaded, now))
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
    const onScroll = () => setScrolledDown(window.scrollY > 320)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const footer = footerRef.current
    if (!footer) return

    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry?.isIntersecting ?? false))
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (!overlay) return
    const root = document.documentElement
    const width = root.clientWidth
    root.style.overflow = "hidden"
    const grown = root.clientWidth - width
    if (grown > 0) root.style.paddingRight = `${grown}px`
    return () => {
      root.style.overflow = ""
      root.style.paddingRight = ""
    }
  }, [overlay])

  useEffect(() => {
    writeStored(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  const copy = useCallback((value: string) => {
    void copyText(value).then((done) => {
      if (!done) return
      setCopiedKey(value)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopiedKey(null), COPIED_RESET_MS)
    })
  }, [])

  const toggleFavorite = useCallback((pubkey: string) => {
    setFavorites((current) =>
      current.includes(pubkey) ? current.filter((key) => key !== pubkey) : [...current, pubkey],
    )
  }, [])

  const sorted = useMemo(() => {
    const matched = providers.filter((provider) => matchesQuery(provider, query))
    return sortProviders(matched, sortField, sortDirection)
  }, [providers, query, sortField, sortDirection])

  const rows = useMemo(() => sorted.slice(0, limit).map((provider) => toRow(provider, t)), [sorted, limit, t])

  const pinned = useMemo(
    () => sorted.filter((provider) => favorites.includes(provider.pubkey)).map((provider) => toRow(provider, t)),
    [sorted, favorites, t],
  )

  const activeFilters = useMemo(() => countActiveFilters(filters, range), [filters, range])
  const draftFilters = useMemo(() => countActiveFilters(draft, range), [draft, range])

  const filterOptions = useMemo(
    () => ({
      locations: range?.locations ?? [],
      storageHashes: hashes.storage,
      providerHashes: hashes.provider,
    }),
    [range, hashes],
  )

  const detailKey = overlay?.kind === "detail" ? overlay.pubkey : null
  const detail = useMemo(() => {
    const provider = providers.find((item) => item.pubkey === detailKey)
    return provider ? toDetail(provider, fetchedAt, t) : null
  }, [providers, detailKey, fetchedAt, t])

  const closeOverlay = useCallback(() => setOverlay(null), [])
  const showSkeleton = loading && providers.length === 0

  const handleSort = (field: SortField) => {
    if (field !== sortField) {
      setSortField(field)
      setSortDirection("desc")
      return
    }
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
  }

  const resetFilters = () => {
    setFilters(NO_FILTERS)
    setDraft(NO_FILTERS)
  }

  const openFilters = () => {
    setDraft(filters)
    setOverlay({ kind: "filters" })
  }

  return (
    <div className={styles.shell}>
      <Header />
      <main id="top" className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>{t("mainTitle")}</h1>
          <p className={styles.subtitle}>{t("mainDescription")}</p>
        </div>

        <div className={styles.searchRow}>
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <input
              className={styles.searchInput}
              type="text"
              name="search"
              autoComplete="off"
              value={query}
              placeholder={t("ui.search")}
              aria-label={t("ui.search")}
              onChange={(event) => {
                setQuery(event.target.value)
                setLimit(PAGE_SIZE)
              }}
            />
            {query && (
              <IconButton className={styles.clear} label={t("ui.clear")} onClick={() => setQuery("")}>
                <X className={styles.clearIcon} aria-hidden="true" />
              </IconButton>
            )}
          </div>

          <span className={styles.filterSlot}>
            <FilterButton variant="icon" active={activeFilters > 0} onClick={openFilters} />
          </span>
        </div>

        {failure && (
          <div className={styles.state}>
            <p>{t("errors.failedToLoadProviders")}</p>
            {failure.status !== null && (
              <p className={styles.errorCode}>{t("errors.statusCode", { status: failure.status })}</p>
            )}
            <button type="button" className={styles.linkButton} onClick={() => setReloadToken((n) => n + 1)}>
              {t("buttons.retry")}
            </button>
          </div>
        )}

        {!loading && !failure && sorted.length === 0 && (
          <div className={styles.state}>
            <p>{t("table.providersNotFound")}</p>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                setQuery("")
                resetFilters()
              }}
            >
              {t("buttons.reset")}
            </button>
          </div>
        )}

        {!failure && (showSkeleton || sorted.length > 0) && (
          <div className={styles.results}>
            <ProviderList
              rows={rows}
              pinned={pinned}
              favorites={favorites}
              copiedKey={copiedKey}
              sortField={sortField}
              sortDirection={sortDirection}
              filtersActive={activeFilters > 0}
              loading={showSkeleton}
              skeletonRows={PAGE_SIZE}
              pinnedSkeletonRows={favorites.length}
              onSort={handleSort}
              onToggleFavorite={toggleFavorite}
              onCopy={copy}
              onOpen={(pubkey) => setOverlay({ kind: "detail", pubkey })}
              onOpenFilters={openFilters}
            />

            {!showSkeleton && (
              <div className={styles.more}>
                <span className={styles.showing}>{t("ui.showing", { shown: rows.length, total: sorted.length })}</span>
                {rows.length < sorted.length && (
                  <button
                    type="button"
                    className={styles.moreButton}
                    onClick={() => setLimit((current) => current + PAGE_SIZE)}
                  >
                    {t("buttons.loadMore")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {scrolledDown && !footerVisible && (
          <button
            type="button"
            className={styles.fab}
            title={t("buttons.goUp")}
            aria-label={t("buttons.goUp")}
            onClick={scrollToTop}
          >
            <ArrowUp className={styles.fabIcon} aria-hidden="true" />
          </button>
        )}

        <Sheet
          open={overlay?.kind === "filters"}
          label={t("filters.title")}
          title={t("filters.title")}
          badge={draftFilters}
          onReset={draftFilters > 0 ? resetFilters : undefined}
          onClose={closeOverlay}
          footer={
            <button
              type="button"
              className={styles.apply}
              onClick={() => {
                setFilters(draft)
                closeOverlay()
              }}
            >
              {t("buttons.applyFilters")}
            </button>
          }
        >
          <Filters value={draft} range={range} options={filterOptions} onChange={setDraft} />
        </Sheet>

        <Sheet open={overlay?.kind === "detail"} label={t("provider.providerTitle")} onClose={closeOverlay}>
          {detail && detailKey && (
            <ProviderDetails key={detailKey} detail={detail} copiedKey={copiedKey} onCopy={copy} />
          )}
        </Sheet>
      </main>
      <Footer ref={footerRef} />
    </div>
  )
}
