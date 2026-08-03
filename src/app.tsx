import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FiltersData } from "@/types/filters"
import { PAGE_SIZE, useCatalog, useMatchCount } from "@/lib/catalog"
import { NO_FILTERS, countActiveFilters } from "@/lib/filters"
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

const COPIED_RESET_MS = 1200

type Overlay = { kind: "filters" } | { kind: "detail"; pubkey: string } | null

export const App = () => {
  const { t } = useTranslation()

  const [filters, setFilters] = useState<FiltersData>(NO_FILTERS)
  const [draft, setDraft] = useState<FiltersData>(NO_FILTERS)
  const [favorites, setFavorites] = useState<string[]>(() => readStoredStrings(FAVORITES_KEY))

  const [overlay, setOverlay] = useState<Overlay>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [scrolledDown, setScrolledDown] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)

  const copyTimer = useRef<number>(0)
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

  const match = useMatchCount({
    draft,
    applied: filters,
    appliedTotal: catalog.total,
    query: catalog.query,
  })

  const activeFilters = useMemo(() => countActiveFilters(filters, catalog.range), [filters, catalog.range])
  const draftFilters = useMemo(() => countActiveFilters(draft, catalog.range), [draft, catalog.range])

  const { detailFor } = catalog
  const detailKey = overlay?.kind === "detail" ? overlay.pubkey : null
  const detail = useMemo(() => (detailKey ? detailFor(detailKey) : null), [detailFor, detailKey])

  const closeOverlay = useCallback(() => setOverlay(null), [])

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
          <div className={styles.state} role="status">
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

        {!catalog.failure && (catalog.showSkeleton || catalog.total > 0) && (
          <div className={styles.results}>
            <ProviderList
              rows={catalog.rows}
              pinned={catalog.pinned}
              favorites={favorites}
              copiedKey={copiedKey}
              sortField={catalog.sortField}
              sortDirection={catalog.sortDirection}
              filtersActive={activeFilters > 0}
              loading={catalog.showSkeleton}
              skeletonRows={PAGE_SIZE}
              pinnedSkeletonRows={favorites.length}
              onSort={catalog.toggleSort}
              onToggleFavorite={toggleFavorite}
              onCopy={copy}
              onOpen={(pubkey) => setOverlay({ kind: "detail", pubkey })}
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
              data-counting={match.counting}
              onClick={() => {
                setFilters(draft)
                closeOverlay()
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
