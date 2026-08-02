import type { FiltersRange } from "@/types/filters"
import type { Provider, StatusReasonStat, Telemetry } from "@/types/provider"
import type {
  BreakdownItem,
  DetailField,
  DetailSection,
  ProviderDetail,
  ProviderRow,
  SortDirection,
  SortField,
  StatusTone,
  StatusView,
} from "@/types/model"
import {
  formatBytes,
  formatDuration,
  formatNumber,
  formatPercent,
  SECONDS_IN_DAY,
  shortenMiddle,
  type Translate,
} from "./format"

const NANO = 1e9
const BITS_IN_MEGABIT = 1e6
const STALE_SECONDS = 600
const PING_LIMIT = 100000
const EMPTY = "—"

const UNAVAILABLE = [101, 102, 103, 201, 202]
const NOT_STORED = [301, 302]
const NO_PROOFS = [401, 402, 403]
const KNOWN_REASONS = [0, ...UNAVAILABLE, ...NOT_STORED, ...NO_PROOFS]

const classify = (status: number | null, ratio: number): { tone: StatusTone; key: string } => {
  if (status === null) return { tone: "gray", key: "noData" }

  if (status === 0) {
    if (ratio < 0.8) return { tone: "red", key: "unstable" }
    if (ratio < 0.99) return { tone: "yellow", key: "partial" }
    return { tone: "green", key: "stable" }
  }

  if (UNAVAILABLE.includes(status)) return { tone: "gray", key: "unavailable" }
  if (NOT_STORED.includes(status)) return { tone: "red", key: "notStored" }
  if (NO_PROOFS.includes(status)) return { tone: "orange", key: "noProofs" }
  return { tone: "gray", key: "unknown" }
}

const reasonLabel = (reason: number, t: Translate): string =>
  KNOWN_REASONS.includes(reason) ? t(`status.reason.${reason}`) : t("status.unknownReason", { reason })

const toStatusView = (status: number | null, ratio: number, t: Translate): StatusView => {
  const { tone, key } = classify(status, ratio)
  return {
    tone,
    label: t(`status.${key}`),
    ratio: status === 0 ? formatPercent(ratio * 100, 1) : null,
  }
}

const freeSpaceOf = (provider: Provider): number | null => {
  const total = provider.telemetry?.total_provider_space
  const used = provider.telemetry?.used_provider_space
  if (total === null || total === undefined || used === null || used === undefined) return null
  return Math.max(0, total - used)
}

export const toRow = (provider: Provider, t: Translate): ProviderRow => {
  const free = freeSpaceOf(provider)

  return {
    pubkey: provider.pubkey,
    keyShort: shortenMiddle(provider.pubkey, 6, 6),
    status: toStatusView(provider.status, provider.status_ratio, t),
    uptime: formatPercent(provider.uptime),
    price: formatNumber(provider.price / NANO, 2),
    priceUnit: t("units.gram"),
    rating: formatNumber(provider.rating, 2),
    freeSpace: free === null ? EMPTY : formatNumber(free, free < 10 ? 1 : 0),
    freeSpaceUnit: free === null ? "" : t("units.gb"),
    location: provider.location?.country ?? t("unknown"),
    workingTime: formatDuration(provider.working_time, t),
  }
}

const SPEED_UNITS: Record<string, number> = {
  B: 1,
  KB: 1e3,
  KIB: 1024,
  MB: 1e6,
  MIB: 1024 ** 2,
  GB: 1e9,
  GIB: 1024 ** 3,
}

const parseSpeed = (value: string | null | undefined): number | null => {
  const match = value === null || value === undefined ? null : /^([\d.]+)\s*(B|[KMG]iB|[KMG]B)\/s$/i.exec(value)
  if (match === null) return null
  const amount = Number(match[1])
  const factor = SPEED_UNITS[match[2].toUpperCase()]
  return factor !== undefined && Number.isFinite(amount) ? amount * factor : null
}

const pickNumbers = (providers: Provider[], pick: (provider: Provider) => number | null | undefined): number[] =>
  providers.map(pick).filter((value): value is number => typeof value === "number" && Number.isFinite(value))

const lowest = (values: number[], fallback: number): number =>
  values.length === 0 ? fallback : values.reduce((min, value) => (value < min ? value : min))

const highest = (values: number[], fallback: number): number =>
  values.length === 0 ? fallback : values.reduce((max, value) => (value > max ? value : max))

export const deriveFiltersRange = (providers: Provider[], now: number): FiltersRange => {
  const of = (pick: (provider: Provider) => number | null | undefined) => pickNumbers(providers, pick)
  const minSpan = of((p) => p.min_span)
  const maxSpan = of((p) => p.max_span)
  const bagSize = of((p) => p.max_bag_size_bytes / 1024 ** 2)
  const totalSpace = of((p) => p.telemetry?.total_provider_space)
  const totalRam = of((p) => p.telemetry?.total_ram)
  const diskRead = of((p) => parseSpeed(p.telemetry?.qd64_disk_read_speed))
  const diskWrite = of((p) => parseSpeed(p.telemetry?.qd64_disk_write_speed))
  const download = of((p) => p.telemetry?.speedtest_download)
  const upload = of((p) => p.telemetry?.speedtest_upload)
  const ping = of((p) => p.telemetry?.speedtest_ping)

  return {
    locations: [
      ...new Set(
        providers
          .map((provider) => provider.location)
          .filter((location) => location?.country && location.country_iso)
          .map((location) => `${location?.country} (${location?.country_iso})`),
      ),
    ].sort(),
    rating_max: highest(of((p) => p.rating), 50),
    reg_time_days_max: highest(of((p) => (now - p.reg_time) / SECONDS_IN_DAY), 1095),
    price_max: highest(of((p) => p.price), 100e9),
    min_span_min: lowest(minSpan, 0),
    min_span_max: highest(minSpan, 2592000),
    max_span_min: lowest(maxSpan, 0),
    max_span_max: highest(maxSpan, 2592000),
    max_bag_size_mb_min: lowest(bagSize, 0),
    max_bag_size_mb_max: highest(bagSize, 40000),
    total_provider_space_min: lowest(totalSpace, 0),
    total_provider_space_max: highest(totalSpace, 40000),
    used_provider_space_max: highest(of((p) => p.telemetry?.used_provider_space), 40000),
    cpu_number_max: highest(of((p) => p.telemetry?.cpu_number), 128),
    total_ram_min: lowest(totalRam, 0),
    total_ram_max: highest(totalRam, 512),
    benchmark_disk_read_speed_min: lowest(diskRead, 0),
    benchmark_disk_read_speed_max: highest(diskRead, 1e9),
    benchmark_disk_write_speed_min: lowest(diskWrite, 0),
    benchmark_disk_write_speed_max: highest(diskWrite, 1e9),
    speedtest_download_min: lowest(download, 0),
    speedtest_download_max: highest(download, 1e9),
    speedtest_upload_min: lowest(upload, 0),
    speedtest_upload_max: highest(upload, 1e9),
    speedtest_ping_min: lowest(ping, 0),
    speedtest_ping_max: highest(ping, 300),
  }
}

export const collectHashes = (
  providers: Provider[],
  current: { storage: string[]; provider: string[] },
): { storage: string[]; provider: string[] } => {
  const storage = new Set(current.storage)
  const provider = new Set(current.provider)

  for (const item of providers) {
    if (item.telemetry?.storage_git_hash) storage.add(item.telemetry.storage_git_hash)
    if (item.telemetry?.provider_git_hash) provider.add(item.telemetry.provider_git_hash)
  }

  if (storage.size === current.storage.length && provider.size === current.provider.length) {
    return current
  }

  return { storage: [...storage].sort(), provider: [...provider].sort() }
}

const sortValue = (provider: Provider, field: SortField): string | number => {
  switch (field) {
    case "pubkey":
      return provider.pubkey
    case "location":
      return provider.location?.country ?? ""
    case "uptime":
      return provider.uptime
    case "workingTime":
      return provider.working_time
    case "price":
      return provider.price
    case "rating":
      return provider.rating
    case "freeSpace":
      return freeSpaceOf(provider) ?? -1
  }
}

export const sortProviders = (
  providers: Provider[],
  field: SortField,
  direction: SortDirection,
): Provider[] => {
  const sign = direction === "asc" ? 1 : -1

  return [...providers].sort((a, b) => {
    const left = sortValue(a, field)
    const right = sortValue(b, field)

    return typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right) * sign
      : (Number(left) - Number(right)) * sign
  })
}

export const matchesQuery = (provider: Provider, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  return needle === "" || provider.pubkey.toLowerCase().includes(needle)
}

const textField = (label: string, value: string | number | null | undefined): DetailField => ({
  label,
  value: value === null || value === undefined || value === "" ? EMPTY : String(value),
})

const truncatedField = (label: string, value: string | null | undefined, copy = false): DetailField => {
  if (!value) return textField(label, null)
  const short = shortenMiddle(value, 14, 6)
  return { label, value: short, title: value, ...(copy ? { copy: value } : {}) }
}

const hardwareSection = (telemetry: Telemetry, t: Translate): DetailSection => ({
  id: "hardware",
  title: t("provider.hardware"),
  fields: [
    truncatedField(t("provider.cpuName"), telemetry.cpu_name),
    textField(t("provider.cpuNumber"), telemetry.cpu_number),
    textField(
      t("provider.cpuIsVirtual"),
      telemetry.cpu_is_virtual === null || telemetry.cpu_is_virtual === undefined
        ? null
        : t(telemetry.cpu_is_virtual ? "triState.yes" : "triState.no"),
    ),
    textField(
      t("provider.ram"),
      telemetry.total_ram
        ? `${formatNumber(telemetry.usage_ram ?? 0, 1)} / ${formatNumber(telemetry.total_ram, 1)} ${t("units.gb")}`
        : null,
    ),
    textField(
      t("provider.totalProviderSpace"),
      telemetry.total_provider_space
        ? `${formatNumber(telemetry.used_provider_space ?? 0, 1)} / ${formatNumber(telemetry.total_provider_space, 1)} ${t("units.gb")}`
        : null,
    ),
  ],
})

const networkSection = (telemetry: Telemetry, t: Translate): DetailSection => ({
  id: "network",
  title: t("provider.network"),
  fields: [
    textField(
      t("provider.speedtestDownload"),
      telemetry.speedtest_download
        ? `${formatNumber(telemetry.speedtest_download / BITS_IN_MEGABIT, 0)} ${t("units.mbps")}`
        : null,
    ),
    textField(
      t("provider.speedtestUpload"),
      telemetry.speedtest_upload
        ? `${formatNumber(telemetry.speedtest_upload / BITS_IN_MEGABIT, 0)} ${t("units.mbps")}`
        : null,
    ),
    textField(
      t("provider.speedtestPing"),
      telemetry.speedtest_ping && telemetry.speedtest_ping < PING_LIMIT
        ? `${formatNumber(telemetry.speedtest_ping, 1)} ${t("units.ms")}`
        : null,
    ),
    textField(t("provider.country"), telemetry.country),
    truncatedField(t("provider.isp"), telemetry.isp),
  ],
})

const telemetrySections = (telemetry: Telemetry, t: Translate): DetailSection[] => [
  {
    id: "software",
    title: t("provider.software"),
    fields: [
      truncatedField(t("provider.storageGitHash"), telemetry.storage_git_hash, true),
      truncatedField(t("provider.providerGitHash"), telemetry.provider_git_hash, true),
    ],
  },
  {
    id: "benchmarks",
    title: t("provider.benchmarks"),
    fields: [
      textField(t("provider.diskReadSpeed"), telemetry.qd64_disk_read_speed),
      textField(t("provider.diskWriteSpeed"), telemetry.qd64_disk_write_speed),
    ],
  },
  hardwareSection(telemetry, t),
  networkSection(telemetry, t),
]

const dominantReason = (stats: StatusReasonStat[], total: number): number | null => {
  const top = stats[0]
  if (!top) return null
  if (top.reason !== 0) return top.reason
  return top.cnt >= total * 0.8 || stats.length === 1 ? 0 : stats[1].reason
}

const buildBreakdown = (stats: StatusReasonStat[], total: number, t: Translate): BreakdownItem[] =>
  stats
    .filter((stat) => stat.cnt > 0)
    .map((stat) => ({
      id: String(stat.reason),
      tone: stat.reason === 0 ? "green" : classify(stat.reason, 0).tone,
      label: stat.reason === 0 ? t("status.allChecksPassed") : reasonLabel(stat.reason, t),
      count: stat.cnt,
      percent: formatPercent((stat.cnt / total) * 100, 1),
    }))

const agoField = (label: string, age: number | null, t: Translate): DetailField =>
  age === null
    ? textField(label, null)
    : {
        label,
        value: t("provider.ago", { time: formatDuration(age, t) }),
        alert: age > STALE_SECONDS,
      }

export const toDetail = (provider: Provider, fetchedAt: number, t: Translate): ProviderDetail => {
  const stats = (provider.statuses_reason_stats ?? [])
    .filter((stat) => Number.isFinite(stat?.cnt) && Number.isFinite(stat.reason))
    .sort((a, b) => b.cnt - a.cnt)
  const total = stats.reduce((sum, stat) => sum + stat.cnt, 0)
  const valid = stats.find((stat) => stat.reason === 0)?.cnt ?? 0
  const reason = dominantReason(stats, total)
  const city = provider.location?.city
  const country = provider.location?.country
  const onlineAge = provider.last_online_check_time ? fetchedAt - provider.last_online_check_time : null
  const telemetryAge = provider.telemetry?.updated_at ? fetchedAt - provider.telemetry.updated_at : null

  const sections: DetailSection[] = [
    {
      id: "provider",
      title: t("provider.providerTitle"),
      fields: [
        {
          label: t("table.publicKey"),
          value: shortenMiddle(provider.pubkey, 6, 6),
          title: provider.pubkey,
          copy: provider.pubkey,
          uppercase: true,
          mono: true,
        },
        provider.address
          ? {
              label: t("provider.address"),
              value: shortenMiddle(provider.address, 6, 6),
              title: provider.address,
              href: `https://tonscan.org/address/${encodeURIComponent(provider.address)}`,
              copy: provider.address,
              mono: true,
            }
          : textField(t("provider.address"), null),
        textField(t("provider.span"), `${formatDuration(provider.min_span, t)} – ${formatDuration(provider.max_span, t)}`),
        textField(t("provider.maxBagSize"), formatBytes(provider.max_bag_size_bytes, t)),
        textField(t("provider.workingTime"), formatDuration(provider.working_time, t)),
        agoField(t("provider.lastOnline"), onlineAge, t),
        agoField(t("provider.lastTelemetry"), provider.is_send_telemetry ? telemetryAge : null, t),
        textField(t("provider.location"), country ? [country, city].filter(Boolean).join(", ") : t("unknown")),
        textField(t("provider.uptime"), formatPercent(provider.uptime)),
        textField(t("provider.rating"), formatNumber(provider.rating, 2)),
        textField(t("provider.price"), `${formatNumber(provider.price / NANO, 2)} ${t("units.gram")}`),
      ],
    },
  ]

  if (provider.is_send_telemetry && provider.telemetry) {
    sections.push(...telemetrySections(provider.telemetry, t))
  }

  return {
    status: toStatusView(provider.status, provider.status_ratio, t),
    description: reason === null ? t("status.notChecked") : reasonLabel(reason, t),
    checks: total > 0 ? { valid, total, tone: classify(provider.status, valid / total).tone } : null,
    breakdown: total > 0 ? buildBreakdown(stats, total, t) : [],
    sections,
  }
}
