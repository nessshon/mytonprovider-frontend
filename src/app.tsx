import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FiltersData } from "@/types/filters"
import { PAGE_SIZE, useCatalog, useMatchCount } from "@/lib/catalog"
import { NO_FILTERS, countActiveFilters } from "@/lib/filters"
import { FAVORITES_KEY, readStoredStrings, writeStored } from "@/lib/storage"
import { copyText, scrollToTop } from "@/lib/dom"
import { providerUrl, useOpenProvider } from "@/lib/route"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Filters } from "@/components/filters"
import { FilterButton } from "@/components/filter-button"
import { IconButton } from "@/components/icon-button"
import { ProviderDetails, ProviderDetailsSkeleton } from "@/components/provider-details"
import { ProviderList } from "@/components/provider-list"
import { Sheet } from "@/components/sheet"
import styles from "./app.module.css"

const COPIED_RESET_MS = 1200

export const App = () => {
  const { t } = useTranslation()

  const [filters, setFilters] = useState<FiltersData>(NO_FILTERS)
  const [draft, setDraft] = useState<FiltersData>(NO_FILTERS)
  const [favorites, setFavorites] = useState<string[]>(() => readStoredStrings(FAVORITES_KEY))

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [detailKey, openProvider] = useOpenProvider()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [sharedKey, setSharedKey] = useState<string | null>(null)
  const [scrolledDown, setScrolledDown] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)

  const copyTimer = useRef<number>(0)
  const shareTimer = useRef<number>(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const footerRef = useRef<HTMLElement>(null)

  const catalog = useCatalog(filters, favorites)

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

  const anySheetOpen = filtersOpen || detailKey !== null

  useLayoutEffect(() => {
    if (!anySheetOpen) return
    const root = document.documentElement
    const width = root.clientWidth
    root.style.overflow = "hidden"
    const grown = root.clientWidth - width
    if (grown > 0) root.style.paddingRight = `${grown}px`
    return () => {
      root.style.overflow = ""
      root.style.paddingRight = ""
    }
  }, [anySheetOpen])

  useEffect(() => {
    writeStored(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => () => {
    window.clearTimeout(copyTimer.current)
    window.clearTimeout(shareTimer.current)
  }, [])

  const copy = useCallback((value: string) => {
    void copyText(value).then((done) => {
      if (!done) return
      setCopiedKey(value)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopiedKey(null), COPIED_RESET_MS)
    })
  }, [])

  const share = useCallback((pubkey: string) => {
    const url = providerUrl(pubkey)

    if (typeof navigator.share === "function") {
      void navigator.share({ url }).catch(() => undefined)
      return
    }

    void copyText(url).then((done) => {
      if (!done) return
      setSharedKey(pubkey)
      window.clearTimeout(shareTimer.current)
      shareTimer.current = window.setTimeout(() => setSharedKey(null), COPIED_RESET_MS)
    })
  }, [])

  const toggleFavorite = useCallback((pubkey: string) => {
    setFavorites((current) =>
      current.includes(pubkey) ? current.filter((key) => key !== pubkey) : [...current, pubkey],
    )
  }, [])

  const match = useMatchCount({
    draft,
    applied: filters,
    appliedTotal: catalog.total,
    query: catalog.query,
    active: filtersOpen,
  })

  const activeFilters = useMemo(() => countActiveFilters(filters, catalog.range), [filters, catalog.range])
  const draftFilters = useMemo(() => countActiveFilters(draft, catalog.range), [draft, catalog.range])

  const { detailFor } = catalog
  const detail = useMemo(() => (detailKey ? detailFor(detailKey) : null), [detailFor, detailKey])

  const closeFilters = useCallback(() => setFiltersOpen(false), [])

  useEffect(() => {
    if (detailKey !== null && !catalog.loading && !detail) openProvider(null)
  }, [detailKey, detail, catalog.loading, openProvider])

  const resetFilters = () => {
    setFilters(NO_FILTERS)
    setDraft(NO_FILTERS)
  }

  const openFilters = () => {
    setDraft(filters)
    setFiltersOpen(true)
  }

  return (
    <div className={styles.shell}>
      <Header />
      <main id="top" tabIndex={-1} className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>{t("mainTitle")}</h1>
          <p className={styles.subtitle}>{t("mainDescription")}</p>
        </div>

        <div className={styles.searchRow}>
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="text"
              name="search"
              autoComplete="off"
              value={catalog.query}
              placeholder={t("ui.search")}
              aria-label={t("ui.search")}
              onChange={(event) => catalog.setQuery(event.target.value)}
            />
            {catalog.query && (
              <IconButton
                className={styles.clear}
                label={t("ui.clear")}
                onClick={() => {
                  catalog.setQuery("")
                  searchRef.current?.focus()
                }}
              >
                <X className={styles.clearIcon} aria-hidden="true" />
              </IconButton>
            )}
          </div>

          <span className={styles.filterSlot}>
            <FilterButton variant="icon" active={activeFilters > 0} onClick={openFilters} />
          </span>
        </div>

        {catalog.failure && (
          <div className={styles.state} role="status" data-compact={catalog.total > 0}>
            <p>{t("errors.failedToLoadProviders")}</p>
            {catalog.failure.status !== null && (
              <p className={styles.errorCode}>{t("errors.statusCode", { status: catalog.failure.status })}</p>
            )}
            <button type="button" className={styles.linkButton} onClick={catalog.retry}>
              {t("buttons.retry")}
            </button>
          </div>
        )}

        {!catalog.loading && !catalog.failure && catalog.total === 0 && (
          <div className={styles.state} role="status">
            <p>{t("table.providersNotFound")}</p>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                catalog.setQuery("")
                resetFilters()
              }}
            >
              {t("buttons.reset")}
            </button>
          </div>
        )}

        {(catalog.showSkeleton || catalog.total > 0) && (
          <div className={styles.results}>
            <ProviderList
              rows={catalog.rows}
              pinned={catalog.pinned}
              favorites={favorites}
              copiedKey={copiedKey}
              sharedKey={sharedKey}
              sortField={catalog.sortField}
              sortDirection={catalog.sortDirection}
              filtersActive={activeFilters > 0}
              loading={catalog.showSkeleton}
              skeletonRows={PAGE_SIZE}
              pinnedSkeletonRows={favorites.length}
              onSort={catalog.toggleSort}
              onToggleFavorite={toggleFavorite}
              onCopy={copy}
              onShare={share}
              onOpen={openProvider}
              onOpenFilters={openFilters}
            />

            {!catalog.showSkeleton && (
              <div className={styles.more}>
                <span className={styles.showing} role="status">
                  {t("ui.showing", { shown: catalog.rows.length, total: catalog.total })}
                </span>
                {catalog.rows.length < catalog.total && (
                  <button type="button" className={styles.moreButton} onClick={catalog.loadMore}>
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
            onClick={() => {
              scrollToTop()
              document.getElementById("top")?.focus()
            }}
          >
            <ArrowUp className={styles.fabIcon} aria-hidden="true" />
          </button>
        )}

        <Sheet
          open={filtersOpen}
          label={t("filters.title")}
          title={t("filters.title")}
          badge={draftFilters}
          onReset={draftFilters > 0 ? resetFilters : undefined}
          onClose={closeFilters}
          footer={
            <button
              type="button"
              className={styles.apply}
              data-counting={match.counting}
              onClick={() => {
                setFilters(draft)
                closeFilters()
              }}
            >
              {match.total === null
                ? t("buttons.applyFilters")
                : t("buttons.showMatching", { total: match.total })}
            </button>
          }
        >
          <Filters value={draft} range={catalog.range} options={catalog.options} onChange={setDraft} />
        </Sheet>

        <Sheet open={detailKey !== null} label={t("provider.providerTitle")} onClose={() => openProvider(null)}>
          {detail && detailKey ? (
            <ProviderDetails key={detailKey} detail={detail} copiedKey={copiedKey} onCopy={copy} />
          ) : (
            <ProviderDetailsSkeleton />
          )}
        </Sheet>
      </main>
      <Footer ref={footerRef} />
    </div>
  )
}
