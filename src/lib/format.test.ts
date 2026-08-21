import { describe, expect, it } from "vitest"
import {
  formatBytes,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRangeBound,
  parseDecimal,
  shortenMiddle,
} from "./format"
import { translate as t } from "./fixtures"

describe("formatNumber", () => {
  it("strips trailing zeros", () => {
    expect(formatNumber(10.002432, 2)).toBe("10")
    expect(formatNumber(20.415426, 2)).toBe("20.42")
    expect(formatNumber(163.59, 0)).toBe("164")
  })

  it("returns an empty string for values that are not finite", () => {
    expect(formatNumber(Number.NaN, 2)).toBe("")
    expect(formatNumber(Number.POSITIVE_INFINITY, 2)).toBe("")
  })
})

describe("formatPercent", () => {
  it("defaults to two digits and appends the sign", () => {
    expect(formatPercent(99.717606)).toBe("99.72%")
    expect(formatPercent(99.77, 1)).toBe("99.8%")
  })
})

describe("shortenMiddle", () => {
  it("keeps values that already fit", () => {
    expect(shortenMiddle("abcdef", 6, 6)).toBe("abcdef")
  })

  it("keeps the head and the tail", () => {
    expect(shortenMiddle("3a65231e59031a3a0c6f363030712730", 6, 6)).toBe("3a6523…712730")
  })
})

describe("formatDuration", () => {
  it("counts seconds below a minute and clamps negatives", () => {
    expect(formatDuration(45, t)).toBe("45sec")
    expect(formatDuration(-5, t)).toBe("0sec")
  })

  it("switches unit at each boundary", () => {
    expect(formatDuration(600, t)).toBe("10min")
    expect(formatDuration(3600, t)).toBe("1hr")
    expect(formatDuration(86400, t)).toBe("1days")
  })

  it("pairs the leading unit with the next one when it is not zero", () => {
    expect(formatDuration(27064916, t)).toBe("313days 6hr")
    expect(formatDuration(5400, t)).toBe("1hr 30min")
  })

  it("collapses full years", () => {
    expect(formatDuration(31536000, t)).toBe("1year")
    expect(formatDuration(32486400, t)).toBe("1year 11days")
  })
})

describe("formatBytes", () => {
  it("returns an empty string for nothing to show", () => {
    expect(formatBytes(0, t)).toBe("")
    expect(formatBytes(-1, t)).toBe("")
  })

  it("picks the unit by magnitude and counts in thousands", () => {
    expect(formatBytes(512, t)).toBe("512 units.b")
    expect(formatBytes(2048, t)).toBe("2.05 units.kb")
    expect(formatBytes(5 * 1024 ** 2, t)).toBe("5.24 units.mb")
    expect(formatBytes(4 * 1024 ** 3, t)).toBe("4.29 units.gb")
    expect(formatBytes(3725.29 * 1024 ** 3, t)).toBe("4 units.tb")
  })
})

describe("formatRangeBound", () => {
  it("rounds integer bounds and keeps two digits otherwise", () => {
    expect(formatRangeBound(20.42, true)).toBe("20")
    expect(formatRangeBound(20.42, false)).toBe("20.42")
  })
})

describe("parseDecimal", () => {
  it("accepts a comma as the separator", () => {
    expect(parseDecimal("20,42")).toBe(20.42)
  })

  it("rejects blanks and garbage", () => {
    expect(parseDecimal("")).toBeNull()
    expect(parseDecimal("   ")).toBeNull()
    expect(parseDecimal("abc")).toBeNull()
  })
})
