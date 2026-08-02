import { describe, expect, it } from "vitest"
import { NOTHING_LOADED, nextSnapshot } from "./catalog"
import { providers, stable } from "./fixtures"

const NOW = 1785545100

describe("nextSnapshot", () => {
  it("re-reads the thresholds from the catalog while nothing is filtered", () => {
    const first = nextSnapshot(NOTHING_LOADED, providers, {}, NOW)
    const narrowed = nextSnapshot(first, [stable], {}, NOW)

    expect(first.range?.locations).toEqual(["Japan (JP)", "Russia (RU)"])
    expect(narrowed.range?.locations).toEqual(["Russia (RU)"])
  })

  it("keeps the thresholds once a filter narrows the catalog", () => {
    const first = nextSnapshot(NOTHING_LOADED, providers, {}, NOW)
    const filtered = nextSnapshot(first, [stable], { has_free_space: true }, NOW + 60)

    expect(filtered.range).toBe(first.range)
    expect(filtered.providers).toEqual([stable])
  })

  it("remembers versions seen in earlier loads", () => {
    const upgraded = {
      ...stable,
      telemetry: stable.telemetry && { ...stable.telemetry, storage_git_hash: "c0ffee1" },
    }
    const first = nextSnapshot(NOTHING_LOADED, providers, {}, NOW)
    const second = nextSnapshot(first, [upgraded], {}, NOW)

    expect(second.hashes.storage).toEqual(["ba05e00", "c0ffee1"])
  })

  it("stamps when the catalog arrived", () => {
    expect(nextSnapshot(NOTHING_LOADED, providers, {}, NOW).fetchedAt).toBe(NOW)
  })
})
