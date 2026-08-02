import { describe, expect, it } from "vitest"
import { collectHashes, deriveFiltersRange, matchesQuery, sortProviders, toDetail, toRow } from "./model"
import { brokenPing, mostlyFailing, overfilled, providers, silent, stable, translate as t, veteran } from "./fixtures"

const NOW = 1785545100

const sectionTitles = (provider: typeof stable) => toDetail(provider, NOW, t).sections.map((section) => section.id)

const fieldValue = (provider: typeof stable, label: string): string | undefined =>
  toDetail(provider, NOW, t)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.label === label)?.value

describe("toRow", () => {
  it("formats every column of a healthy provider", () => {
    const row = toRow(stable, t)

    expect(row.keyShort).toBe("3a6523…b6b466")
    expect(row.status.label).toBe("status.stable")
    expect(row.status.ratio).toBe("99.8%")
    expect(row.uptime).toBe("99.72%")
    expect(row.price).toBe("10")
    expect(row.rating).toBe("20.42")
    expect(row.freeSpace).toBe("164")
    expect(row.location).toBe("Russia")
    expect(row.workingTime).toBe("313days 6hr")
  })

  it("clamps free space when the node reports more used than it has", () => {
    expect(toRow(overfilled, t).freeSpace).toBe("0")
  })

  it("falls back when telemetry and location are missing", () => {
    const row = toRow(silent, t)

    expect(row.freeSpace).toBe("—")
    expect(row.freeSpaceUnit).toBe("")
    expect(row.location).toBe("unknown")
  })

  it("hides the ratio for a provider that is not answering", () => {
    expect(toRow(silent, t).status.ratio).toBeNull()
    expect(toRow(silent, t).status.label).toBe("status.unavailable")
  })
})

describe("toDetail", () => {
  it("survives a provider the catalog sent without an address", () => {
    const detail = toDetail({ ...stable, address: null }, NOW, t)

    expect(detail.sections.flatMap((section) => section.fields).find((f) => f.label === "provider.address")?.value).toBe(
      "—",
    )
  })

  it("ignores broken entries in the check statistics", () => {
    const broken = { ...stable, statuses_reason_stats: [null, { reason: 0, cnt: 5 }] as never }

    expect(toDetail(broken, NOW, t).checks).toEqual({ valid: 5, total: 5, tone: "green" })
  })

  it("reports the dominant failure instead of the successful minority", () => {
    expect(toDetail(mostlyFailing, NOW, t).description).toBe("status.reason.301")
  })

  it("reports success when it clearly dominates", () => {
    const detail = toDetail(stable, NOW, t)

    expect(detail.description).toBe("status.reason.0")
    expect(detail.checks).toEqual({ valid: 432, total: 433, tone: "green" })
  })

  it("drops the checks block when nothing was ever checked", () => {
    const detail = toDetail(silent, NOW, t)

    expect(detail.checks).toBeNull()
    expect(detail.breakdown).toEqual([])
    expect(detail.description).toBe("status.notChecked")
  })

  it("omits telemetry sections for a provider that does not report", () => {
    expect(sectionTitles(silent)).toEqual(["provider"])
    expect(sectionTitles(stable)).toEqual(["provider", "software", "benchmarks", "hardware", "network"])
  })

  it("hides readings the node could not measure", () => {
    expect(fieldValue(brokenPing, "provider.speedtestPing")).toBe("—")
    expect(fieldValue(brokenPing, "provider.speedtestDownload")).toBe("—")
    expect(fieldValue(stable, "provider.speedtestPing")).toBe("16 units.ms")
  })
})

describe("deriveFiltersRange", () => {
  const range = deriveFiltersRange(providers, NOW)

  it("lists every known location once, sorted", () => {
    expect(range.locations).toEqual(["Japan (JP)", "Russia (RU)"])
  })

  it("takes bounds from the providers it was given", () => {
    expect(range.rating_max).toBeCloseTo(20.415426)
    expect(range.price_max).toBe(10002432000)
    expect(range.total_ram_max).toBe(33.7)
    expect(range.speedtest_ping_max).toBe(1800000)
  })

  it("reads disk speed out of the formatted string", () => {
    expect(range.benchmark_disk_read_speed_max).toBeCloseTo(63.9 * 1024 ** 2)
  })

  it("falls back when there is nothing to measure", () => {
    expect(deriveFiltersRange([], NOW).rating_max).toBe(50)
  })
})

describe("sortProviders", () => {
  it("orders by rating in both directions", () => {
    expect(sortProviders(providers, "rating", "desc")[0]).toBe(stable)
    expect(sortProviders(providers, "rating", "asc")[0]).toBe(silent)
  })

  it("orders text by locale", () => {
    const byLocation = sortProviders([veteran, stable], "location", "asc")

    expect(byLocation.map((provider) => provider.location?.country)).toEqual(["Japan", "Russia"])
  })

  it("sends providers without free space to the bottom", () => {
    expect(sortProviders(providers, "freeSpace", "desc")[providers.length - 1]).toBe(silent)
  })

  it("leaves the input untouched", () => {
    const input = [...providers]
    sortProviders(input, "rating", "asc")

    expect(input).toEqual(providers)
  })
})

describe("matchesQuery", () => {
  it("matches any part of the key regardless of case", () => {
    expect(matchesQuery(stable, "")).toBe(true)
    expect(matchesQuery(stable, "  ")).toBe(true)
    expect(matchesQuery(stable, "3A6523")).toBe(true)
    expect(matchesQuery(stable, "B6B466")).toBe(true)
    expect(matchesQuery(stable, "zzzz")).toBe(false)
  })
})

describe("collectHashes", () => {
  const empty = { storage: [] as string[], provider: [] as string[] }

  it("gathers every hash it has seen", () => {
    expect(collectHashes(providers, empty)).toEqual({ storage: ["ba05e00"], provider: ["8c7ca5b"] })
  })

  it("keeps the previous value when nothing is new", () => {
    const first = collectHashes(providers, empty)

    expect(collectHashes(providers, first)).toBe(first)
  })

  it("keeps hashes that dropped out of the current answer", () => {
    const seeded = { storage: ["deadbee"], provider: [] as string[] }

    expect(collectHashes(providers, seeded).storage).toEqual(["ba05e00", "deadbee"])
  })
})
