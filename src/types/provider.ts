export interface Telemetry {
  storage_git_hash?: string | null
  provider_git_hash?: string | null
  total_provider_space?: number | null
  used_provider_space?: number | null
  updated_at?: number | null
  cpu_name?: string | null
  cpu_number?: number | null
  cpu_is_virtual?: boolean | null
  total_ram?: number | null
  usage_ram?: number | null
  qd64_disk_read_speed?: string | null
  qd64_disk_write_speed?: string | null
  speedtest_download?: number | null
  speedtest_upload?: number | null
  speedtest_ping?: number | null
  country?: string | null
  isp?: string | null
}

interface ProviderLocation {
  country: string
  country_iso: string
  city: string
}

export interface StatusReasonStat {
  reason: number
  cnt: number
}

export interface Provider {
  pubkey: string
  address: string
  status: number | null
  status_ratio: number
  location: ProviderLocation | null
  uptime: number
  working_time: number
  rating: number
  price: number
  min_span: number
  max_span: number
  max_bag_size_bytes: number
  reg_time: number
  last_online_check_time: number
  is_send_telemetry: boolean
  telemetry: Telemetry | null
  statuses_reason_stats?: StatusReasonStat[]
}
