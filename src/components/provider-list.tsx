import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, ChevronDown, HelpCircle, Star } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ProviderRow, SortDirection, SortField } from "@/types/model"
import { CopyButton } from "./copy-button"
import { IconButton } from "./icon-button"
import { FilterButton } from "./filter-button"
import styles from "./provider-list.module.css"
import { cx } from "@/lib/cx"

type StatId = "rating" | "uptime" | "price" | "freeSpace" | "workingTime" | "location"

interface Column {
  id: StatId | "pubkey" | "status"
  label: string
  hint?: string
  sort?: SortField
}

const COLUMNS: Column[] = [
  { id: "pubkey", label: "table.publicKey", sort: "pubkey" },
  { id: "rating", label: "table.rating", sort: "rating" },
  { id: "status", label: "table.status", hint: "status.accessibleFilesHint" },
  { id: "uptime", label: "table.uptime", hint: "status.uptimeHint", sort: "uptime" },
  { id: "price", label: "table.price", hint: "status.priceHint", sort: "price" },
  { id: "freeSpace", label: "table.freeSpace", hint: "status.freeSpaceHint", sort: "freeSpace" },
  { id: "workingTime", label: "table.workingTime", sort: "workingTime" },
  { id: "location", label: "table.location", sort: "location" },
]

const STAGGER_LIMIT = 10

const ORDER: Record<StatId, string> = {
  rating: styles.orderRating,
  uptime: styles.orderUptime,
  price: styles.orderPrice,
  freeSpace: styles.orderFreeSpace,
  workingTime: styles.orderWorkingTime,
  location: styles.orderLocation,
}

const STAT_COLUMNS = COLUMNS.filter(
  (column): column is Column & { id: StatId } => column.id !== "pubkey" && column.id !== "status",
)

const SKELETON_VALUE: Record<StatId, string> = {
  rating: "4em",
  uptime: "3.7em",
  price: "4.3em",
  freeSpace: "3.5em",
  workingTime: "4.2em",
  location: "4.3em",
}

const STAT_VALUES: Record<StatId, (row: ProviderRow) => ReactNode> = {
  rating: (row) => (
    <>
      <Star className={styles.star} aria-hidden="true" />
      <span>{row.rating}</span>
    </>
  ),
  uptime: (row) => <span>{row.uptime}</span>,
  price: (row) => (
    <>
      <span>{row.price}</span>
      <span className={styles.unit}>{row.priceUnit}</span>
    </>
  ),
  freeSpace: (row) => (
    <>
      <span>{row.freeSpace}</span>
      {row.freeSpaceUnit && <span className={styles.unit}>{row.freeSpaceUnit}</span>}
    </>
  ),
  workingTime: (row) => <span>{row.workingTime}</span>,
  location: (row) => <span>{row.location}</span>,
}

interface CardProps {
  row: ProviderRow
  index: number
  favorite: boolean
  copied: boolean
  onToggleFavorite: (pubkey: string) => void
  onCopy: (pubkey: string) => void
  onOpen: (pubkey: string) => void
}

const shape = (...names: string[]) => cx(styles.shape, ...names)

const SkeletonCard = ({ index }: { index: number }) => {
  const { t } = useTranslation()

  return (
    <article
      className={cx(styles.card, styles.placeholder)}
      style={{ "--card-index": index } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className={styles.head}>
        <span className={cx(shape(styles.shapeCircleSm), styles.orderFavorite)} />
        <div className={cx(styles.key, styles.orderKey)}>
          <span className={shape(styles.shapeKey)} />
        </div>
        <span className={cx(styles.status, styles.orderStatus)}>
          <span className={shape(styles.shapeStatus)} />
        </span>
      </div>

      <div className={styles.stats}>
        {STAT_COLUMNS.map((column) => (
          <div key={column.id} className={cx(styles.cell, ORDER[column.id])}>
            <span className={styles.label}>
              <span className={shape(styles.shapeText)}>{t(column.label)}</span>
            </span>
            <span className={styles.value}>
              <span
                className={shape(styles.shapeValue)}
                style={{ "--shape-w": SKELETON_VALUE[column.id] } as React.CSSProperties}
              />
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}

const Cell = ({ id, label, children }: { id: StatId; label: string; children: ReactNode }) => (
  <div className={cx(styles.cell, ORDER[id])}>
    <span className={styles.label}>{label}</span>
    <span className={styles.value}>{children}</span>
  </div>
)

const ProviderCard = ({ row, index, favorite, copied, onToggleFavorite, onCopy, onOpen }: CardProps) => {
  const { t } = useTranslation()

  return (
    <article
      className={styles.card}
      style={{ "--card-index": index } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`${t("table.providerDetails")} ${row.keyShort}`}
      onClick={() => onOpen(row.pubkey)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onOpen(row.pubkey)
      }}
    >
      <div className={styles.head}>
        <IconButton
          size="sm"
          label={t("ui.favorites")}
          className={cx(styles.favorite, styles.orderFavorite, favorite && styles.favoriteActive)}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite(row.pubkey)
          }}
        >
          <Star className={styles.starIcon} aria-hidden="true" />
        </IconButton>

        <div className={cx(styles.key, styles.orderKey)}>
          <span className={styles.keyText}>{row.keyShort}</span>
          <CopyButton value={row.pubkey} copied={copied} onCopy={onCopy} />
        </div>

        <span className={cx(styles.status, styles.orderStatus)} data-tone={row.status.tone}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.statusLabel}>{row.status.label}</span>
          {row.status.ratio && <span className={styles.ratio}>{row.status.ratio}</span>}
        </span>
      </div>

      <div className={styles.stats}>
        {STAT_COLUMNS.map((column) => (
          <Cell key={column.id} id={column.id} label={t(column.label)}>
            {STAT_VALUES[column.id](row)}
          </Cell>
        ))}
      </div>
    </article>
  )
}

interface ProviderListProps {
  rows: ProviderRow[]
  pinned: ProviderRow[]
  favorites: string[]
  copiedKey: string | null
  sortField: SortField
  sortDirection: SortDirection
  filtersActive: boolean
  loading: boolean
  skeletonRows: number
  pinnedSkeletonRows: number
  onSort: (field: SortField) => void
  onToggleFavorite: (pubkey: string) => void
  onCopy: (pubkey: string) => void
  onOpen: (pubkey: string) => void
  onOpenFilters: () => void
}

export const ProviderList = ({
  rows,
  pinned,
  favorites,
  copiedKey,
  sortField,
  sortDirection,
  filtersActive,
  loading,
  skeletonRows,
  pinnedSkeletonRows,
  onSort,
  onToggleFavorite,
  onCopy,
  onOpen,
  onOpenFilters,
}: ProviderListProps) => {
  const { t } = useTranslation()

  const renderCard = (row: ProviderRow, index: number) => (
    <ProviderCard
      key={row.pubkey}
      row={row}
      index={index % STAGGER_LIMIT}
      favorite={favorites.includes(row.pubkey)}
      copied={copiedKey === row.pubkey}
      onToggleFavorite={onToggleFavorite}
      onCopy={onCopy}
      onOpen={onOpen}
    />
  )

  const pinnedCards = loading
    ? Array.from({ length: pinnedSkeletonRows }, (_, index) => (
        <SkeletonCard key={index} index={index % STAGGER_LIMIT} />
      ))
    : pinned.map(renderCard)

  return (
    <div>
      {pinnedCards.length > 0 && (
        <div className={cx(styles.list, styles.pinned)}>{pinnedCards}</div>
      )}

      <div className={styles.headerRow}>
        <span />
        {COLUMNS.map((column) => {
          const isActive = column.sort !== undefined && column.sort === sortField
          const className = cx(styles.headerCell, column.sort && styles.sortable, isActive && styles.active)

          const content = (
            <>
              <span className={styles.headerLabel}>{t(column.label)}</span>
              {column.hint && (
                <span className={styles.hint} data-hint={t(column.hint)} tabIndex={0} aria-label={t(column.hint)}>
                  <HelpCircle className={styles.hintIcon} aria-hidden="true" />
                </span>
              )}
              {isActive &&
                (sortDirection === "asc" ? (
                  <ArrowUp className={styles.sortIcon} aria-hidden="true" />
                ) : (
                  <ArrowDown className={styles.sortIcon} aria-hidden="true" />
                ))}
            </>
          )

          const sort = column.sort

          return sort ? (
            <button key={column.id} type="button" className={className} onClick={() => onSort(sort)}>
              {content}
            </button>
          ) : (
            <span key={column.id} className={className}>
              {content}
            </span>
          )
        })}
      </div>

      <div className={styles.sortBar}>
        <FilterButton variant="labeled" active={filtersActive} onClick={onOpenFilters} />

        <div className={styles.sortSelect}>
          <select
            className={styles.select}
            name="sort"
            value={sortField}
            aria-label={t("ui.sortBy")}
            onChange={(event) => onSort(event.target.value as SortField)}
          >
            {COLUMNS.filter((column) => column.sort).map((column) => (
              <option key={column.id} value={column.sort}>
                {t(column.label)}
              </option>
            ))}
          </select>
          <ChevronDown className={styles.selectIcon} aria-hidden="true" />
        </div>

        <IconButton className={styles.direction} label={t("ui.sortDirection")} onClick={() => onSort(sortField)}>
          {sortDirection === "asc" ? (
            <ArrowUp className={styles.directionIcon} aria-hidden="true" />
          ) : (
            <ArrowDown className={styles.directionIcon} aria-hidden="true" />
          )}
        </IconButton>
      </div>

      <div className={styles.list}>
        {loading
          ? Array.from({ length: skeletonRows }, (_, index) => (
              <SkeletonCard key={index} index={index % STAGGER_LIMIT} />
            ))
          : rows.map(renderCard)}
      </div>
    </div>
  )
}
