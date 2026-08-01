import type { FiltersData, FiltersRange } from "@/types/filters"
import type { SectionId } from "@/types/model"

type RangeBounds = (range: FiltersRange | null) => [number, number]

export type OptionSource = "locations" | "storageHashes" | "providerHashes"

export interface RangeFilterField {
  kind: "range"
  from: keyof FiltersData
  to: keyof FiltersData
  label: string
  step: number
  integer: boolean
  bounds: RangeBounds
  scale?: number
}

export type FilterField =
  | { kind: "select"; key: keyof FiltersData; label: string; source: OptionSource; placeholder: string }
  | { kind: "text"; key: keyof FiltersData; label: string }
  | { kind: "tri"; key: keyof FiltersData; label: string }
  | { kind: "flag"; key: keyof FiltersData; label: string }
  | RangeFilterField

interface FilterGroup {
  id: SectionId
  fields: FilterField[]
}

export const FILTER_GROUPS: FilterGroup[] = [
  {
    id: "provider",
    fields: [
      {
        kind: "select",
        key: "location",
        label: "filters.location",
        source: "locations",
        placeholder: "filters.locationPlaceholder",
      },
      { kind: "flag", key: "has_free_space", label: "filters.onlyWithFreeSpace" },
      {
        kind: "range",
        from: "rating_gt",
        to: "rating_lt",
        label: "filters.rating",
        step: 0.01,
        integer: false,
        bounds: (r) => [0, r?.rating_max ?? 50],
      },
      {
        kind: "range",
        from: "reg_time_days_gt",
        to: "reg_time_days_lt",
        label: "filters.registrationTime",
        step: 1,
        integer: true,
        bounds: (r) => [0, r?.reg_time_days_max ?? 1095],
      },
      {
        kind: "range",
        from: "uptime_gt_percent",
        to: "uptime_lt_percent",
        label: "filters.uptime",
        step: 0.1,
        integer: false,
        bounds: () => [0, 100],
      },
      {
        kind: "range",
        from: "price_gt",
        to: "price_lt",
        label: "filters.price",
        step: 0.1,
        integer: false,
        bounds: (r) => [0, (r?.price_max ?? 100e9) / 1e9],
      },
      {
        kind: "range",
        from: "min_span_gt",
        to: "min_span_lt",
        label: "filters.minSpan",
        step: 3600,
        integer: true,
        bounds: (r) => [r?.min_span_min ?? 0, r?.min_span_max ?? 2592000],
      },
      {
        kind: "range",
        from: "max_span_gt",
        to: "max_span_lt",
        label: "filters.maxSpan",
        step: 1,
        integer: true,
        scale: 86400,
        bounds: (r) => [r?.max_span_min ?? 0, r?.max_span_max ?? 2592000],
      },
      {
        kind: "range",
        from: "max_bag_size_mb_gt",
        to: "max_bag_size_mb_lt",
        label: "filters.maxBagSize",
        step: 1,
        integer: true,
        bounds: (r) => [r?.max_bag_size_mb_min ?? 0, r?.max_bag_size_mb_max ?? 40000],
      },
    ],
  },
  {
    id: "benchmarks",
    fields: [
      {
        kind: "range",
        from: "benchmark_disk_read_speed_gt",
        to: "benchmark_disk_read_speed_lt",
        label: "filters.diskReadSpeed",
        step: 1,
        integer: true,
        bounds: (r) => [
          Math.floor((r?.benchmark_disk_read_speed_min ?? 0) / 1024),
          Math.ceil((r?.benchmark_disk_read_speed_max ?? 1e9) / 1024),
        ],
      },
      {
        kind: "range",
        from: "benchmark_disk_write_speed_gt",
        to: "benchmark_disk_write_speed_lt",
        label: "filters.diskWriteSpeed",
        step: 1,
        integer: true,
        bounds: (r) => [
          Math.floor((r?.benchmark_disk_write_speed_min ?? 0) / 1024),
          Math.ceil((r?.benchmark_disk_write_speed_max ?? 1e9) / 1024),
        ],
      },
    ],
  },
  {
    id: "hardware",
    fields: [
      {
        kind: "range",
        from: "total_provider_space_gt",
        to: "total_provider_space_lt",
        label: "filters.totalProviderSpace",
        step: 10,
        integer: true,
        bounds: (r) => [r?.total_provider_space_min ?? 0, r?.total_provider_space_max ?? 40000],
      },
      {
        kind: "range",
        from: "used_provider_space_gt",
        to: "used_provider_space_lt",
        label: "filters.usedProviderSpace",
        step: 10,
        integer: true,
        bounds: (r) => [0, r?.used_provider_space_max ?? 40000],
      },
      {
        kind: "range",
        from: "cpu_number_gt",
        to: "cpu_number_lt",
        label: "filters.cpuNumber",
        step: 1,
        integer: true,
        bounds: (r) => [1, r?.cpu_number_max ?? 128],
      },
      { kind: "text", key: "cpu_name", label: "filters.cpuName" },
      { kind: "tri", key: "cpu_is_virtual", label: "filters.cpuIsVirtual" },
      {
        kind: "range",
        from: "total_ram_gt",
        to: "total_ram_lt",
        label: "filters.totalRam",
        step: 1,
        integer: false,
        bounds: (r) => [r?.total_ram_min ?? 0, r?.total_ram_max ?? 512],
      },
      {
        kind: "range",
        from: "usage_ram_percent_gt",
        to: "usage_ram_percent_lt",
        label: "filters.usedRamPercent",
        step: 1,
        integer: true,
        bounds: () => [0, 100],
      },
    ],
  },
  {
    id: "network",
    fields: [
      {
        kind: "range",
        from: "speedtest_download_speed_gt",
        to: "speedtest_download_speed_lt",
        label: "filters.downloadSpeed",
        step: 1,
        integer: true,
        bounds: (r) => [
          Math.floor((r?.speedtest_download_min ?? 0) / 1e6),
          Math.ceil((r?.speedtest_download_max ?? 1e9) / 1e6),
        ],
      },
      {
        kind: "range",
        from: "speedtest_upload_speed_gt",
        to: "speedtest_upload_speed_lt",
        label: "filters.uploadSpeed",
        step: 1,
        integer: true,
        bounds: (r) => [
          Math.floor((r?.speedtest_upload_min ?? 0) / 1e6),
          Math.ceil((r?.speedtest_upload_max ?? 1e9) / 1e6),
        ],
      },
      {
        kind: "range",
        from: "speedtest_ping_gt",
        to: "speedtest_ping_lt",
        label: "filters.ping",
        step: 1,
        integer: true,
        bounds: (r) => [r?.speedtest_ping_min ?? 0, Math.min(r?.speedtest_ping_max ?? 300, 1000)],
      },
      { kind: "text", key: "country", label: "filters.country" },
      { kind: "text", key: "isp", label: "filters.isp" },
    ],
  },
  {
    id: "software",
    fields: [
      {
        kind: "select",
        key: "storage_git_hash",
        label: "filters.storageGitHash",
        source: "storageHashes",
        placeholder: "filters.anyHash",
      },
      {
        kind: "select",
        key: "provider_git_hash",
        label: "filters.providerGitHash",
        source: "providerHashes",
        placeholder: "filters.anyHash",
      },
      { kind: "tri", key: "is_send_telemetry", label: "filters.isSendTelemetry" },
    ],
  },
]
