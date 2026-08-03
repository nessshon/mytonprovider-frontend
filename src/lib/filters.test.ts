import { describe, expect, it } from "vitest"
import type { FiltersRange } from "@/types/filters"
import {
  NO_FILTERS,
  countActiveFilters,
  isPristine,
  toGroupViews,
  type FieldView,
  type OptionSource,
} from "./filters"
import { deriveFiltersRange } from "./model"
import { providers } from "./fixtures"

const NOW = 1785545100
const range: FiltersRange = deriveFiltersRange(providers, NOW)
const options: Record<OptionSource, string[]> = {
  locations: range.locations,
  storageHashes: ["ba05e00"],
  providerHashes: ["8c7ca5b"],
}

const view = (filters = NO_FILTERS) => toGroupViews(filters, range, options)

const field = (label: string, filters = NO_FILTERS): FieldView => {
  const found = view(filters)
    .flatMap((group) => group.fields)
    .find((candidate) => candidate.label === label)
  if (!found) throw new Error(`no field labelled ${label}`)
  return found
}

const range_ = (label: string, filters = NO_FILTERS) => {
  const found = field(label, filters)
  if (found.kind !== "range") throw new Error(`${label} is not a range`)
  return found
}

describe("toGroupViews", () => {
  it("covers every group and hands each field a name", () => {
    const groups = view()

    expect(groups.map((group) => group.id)).toEqual(["provider", "benchmarks", "hardware", "network", "software"])
    expect(groups.flatMap((group) => group.fields).every((f) => f.name.length > 0)).toBe(true)
  })

  it("feeds the location list into the select", () => {
    const location = field("filters.location")

    expect(location.kind).toBe("select")
    if (location.kind === "select") expect(location.options).toEqual(["Japan (JP)", "Russia (RU)"])
  })

  it("opens a range on whole steps of its own bounds", () => {
    expect(range_("filters.rating")).toMatchObject({ min: 0, max: 21, low: 0, high: 21 })
  })

  it("shows scaled ranges in the unit the label promises", () => {
    expect(range_("filters.maxSpan")).toMatchObject({ min: 30, max: 77 })
  })
})

describe("activity", () => {
  it("counts nothing before anything is touched", () => {
    expect(countActiveFilters(NO_FILTERS)).toBe(0)
    expect(view().every((group) => group.active === 0)).toBe(true)
  })

  it("counts nothing when a range is put back on its bounds", () => {
    const rating = range_("filters.rating")
    const settled = rating.set(rating.low, rating.high)

    expect(countActiveFilters(settled)).toBe(0)
  })

  it("counts a moved range once, not once per bound", () => {
    const rating = range_("filters.rating")
    const moved = rating.set(0.05, rating.high)

    expect(countActiveFilters(moved)).toBe(1)
    expect(view(moved)[0].active).toBe(1)
  })

  it("counts a switch only while it is on", () => {
    const free = field("filters.onlyWithFreeSpace")
    if (free.kind !== "flag") throw new Error("expected a flag")

    expect(countActiveFilters(free.set(true))).toBe(1)
    expect(countActiveFilters(free.set(undefined))).toBe(0)
  })
})

describe("setting a value", () => {
  it("keeps fractional steps a whole-number rounding would destroy", () => {
    const rating = range_("filters.rating")

    expect(rating.set(0.05, rating.high).rating_gt).toBe(0.05)
  })

  it("sends internet speed under the key the catalog answers to, in bits per second", () => {
    const download = range_("filters.downloadSpeed")
    const upload = range_("filters.uploadSpeed")

    expect(download.set(100, download.high).speedtest_download_gt).toBe(100_000_000)
    expect(upload.set(50, upload.high).speedtest_upload_gt).toBe(50_000_000)
  })

  it("stores scaled ranges in the units the catalog expects", () => {
    const maxSpan = range_("filters.maxSpan")

    expect(maxSpan.set(5, maxSpan.high).max_span_gt).toBe(432000)
  })

  it("reads a stored range back into display units", () => {
    const maxSpan = range_("filters.maxSpan")
    const stored = maxSpan.set(5, maxSpan.high)

    expect(range_("filters.maxSpan", stored).low).toBe(5)
  })

  it("drops a text filter instead of storing an empty one", () => {
    const isp = field("filters.isp")
    if (isp.kind !== "text") throw new Error("expected a text field")

    expect(isp.set("JSC")).toEqual({ isp: "JSC" })
    expect(isp.set("")).toEqual({})
  })

  it("leaves the filters it was given untouched", () => {
    const before = { isp: "JSC" }
    const isp = field("filters.isp", before)
    if (isp.kind !== "text") throw new Error("expected a text field")

    isp.set("other")
    expect(before).toEqual({ isp: "JSC" })
  })
})

describe("isPristine", () => {
  it("is true only while nothing is stored", () => {
    const rating = range_("filters.rating")

    expect(isPristine(NO_FILTERS)).toBe(true)
    expect(isPristine(rating.set(0.05, rating.high))).toBe(false)
  })

  it("comes back once a range is dragged onto its own bounds again", () => {
    const rating = range_("filters.rating")
    const moved = rating.set(0.05, rating.high)
    const back = range_("filters.rating", moved).set(rating.low, rating.high)

    expect(back).toEqual({})
    expect(isPristine(back)).toBe(true)
  })
})
