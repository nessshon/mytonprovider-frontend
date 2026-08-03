import type { FiltersData, FiltersRange } from "@/types/filters"
import type { SectionId } from "@/types/model"
import { FILTER_GROUPS, type FilterField, type OptionSource, type RangeFilterField } from "./filter-fields"

export type { OptionSource } from "./filter-fields"

export const NO_FILTERS: FiltersData = {}

interface CommonView {
  name: string
  label: string
}

export type FieldView =
  | (CommonView & {
      kind: "select"
      value: string
      placeholder: string
      options: string[]
      set: (next: string) => FiltersData
    })
  | (CommonView & { kind: "text"; value: string; set: (next: string) => FiltersData })
  | (CommonView & { kind: "tri"; value: boolean | undefined; set: (next: boolean | undefined) => FiltersData })
  | (CommonView & { kind: "flag"; value: boolean | undefined; set: (next: boolean | undefined) => FiltersData })
  | (CommonView & {
      kind: "range"
      toName: string
      min: number
      max: number
      step: number
      integer: boolean
      low: number
      high: number
      set: (low: number, high: number) => FiltersData
    })

interface GroupView {
  id: SectionId
  active: number
  fields: FieldView[]
}

const limitsOf = (field: RangeFilterField, range: FiltersRange | null) => {
  const scale = field.scale ?? 1
  const [minRaw, maxRaw] = field.bounds(range)
  return { min: Math.floor(minRaw / scale), max: Math.ceil(maxRaw / scale), scale }
}

const toStored = (field: RangeFilterField, value: number): number => {
  const raw = value * (field.scale ?? 1)
  return field.integer ? Math.round(raw) : Number(raw.toFixed(6))
}

const isSet = (value: FiltersData[keyof FiltersData]): boolean => value !== undefined && value !== ""

const activeIn = (fields: FilterField[], filters: FiltersData): number => {
  let active = 0

  for (const field of fields) {
    if (field.kind === "range") {
      if (filters[field.from] !== undefined || filters[field.to] !== undefined) active += 1
      continue
    }

    if (isSet(filters[field.key])) active += 1
  }

  return active
}

const withValue = (filters: FiltersData, key: keyof FiltersData, next: string | boolean | undefined): FiltersData => {
  const draft: FiltersData = { ...filters }
  if (isSet(next)) Object.assign(draft, { [key]: next })
  else delete draft[key]
  return draft
}

const withBound = (draft: FiltersData, key: keyof FiltersData, value: number, edge: number): void => {
  if (value === edge) delete draft[key]
  else Object.assign(draft, { [key]: value })
}

const textOf = (filters: FiltersData, key: keyof FiltersData): string => {
  const current = filters[key]
  return typeof current === "string" ? current : ""
}

const flagOf = (filters: FiltersData, key: keyof FiltersData): boolean | undefined => {
  const current = filters[key]
  return typeof current === "boolean" ? current : undefined
}

const numberOf = (filters: FiltersData, key: keyof FiltersData, fallback: number): number => {
  const current = filters[key]
  return typeof current === "number" ? current : fallback
}

const toFieldView = (
  field: FilterField,
  filters: FiltersData,
  range: FiltersRange | null,
  options: Record<OptionSource, string[]>,
): FieldView => {
  if (field.kind === "range") {
    const { min, max, scale } = limitsOf(field, range)

    return {
      kind: "range",
      name: field.from,
      toName: field.to,
      label: field.label,
      min,
      max,
      step: field.step,
      integer: field.integer,
      low: numberOf(filters, field.from, toStored(field, min)) / scale,
      high: numberOf(filters, field.to, toStored(field, max)) / scale,
      set: (low, high) => {
        const draft: FiltersData = { ...filters }
        withBound(draft, field.from, toStored(field, low), toStored(field, min))
        withBound(draft, field.to, toStored(field, high), toStored(field, max))
        return draft
      },
    }
  }

  const common = { name: field.key, label: field.label }

  if (field.kind === "select") {
    return {
      ...common,
      kind: "select",
      value: textOf(filters, field.key),
      placeholder: field.placeholder,
      options: options[field.source],
      set: (next) => withValue(filters, field.key, next),
    }
  }

  if (field.kind === "text") {
    return { ...common, kind: "text", value: textOf(filters, field.key), set: (next) => withValue(filters, field.key, next) }
  }

  return {
    ...common,
    kind: field.kind,
    value: flagOf(filters, field.key),
    set: (next) => withValue(filters, field.key, next),
  }
}

export const toGroupViews = (
  filters: FiltersData,
  range: FiltersRange | null,
  options: Record<OptionSource, string[]>,
): GroupView[] =>
  FILTER_GROUPS.map((group) => ({
    id: group.id,
    active: activeIn(group.fields, filters),
    fields: group.fields.map((field) => toFieldView(field, filters, range, options)),
  }))

export const countActiveFilters = (filters: FiltersData): number =>
  FILTER_GROUPS.reduce((total, group) => total + activeIn(group.fields, filters), 0)

export const isPristine = (filters: FiltersData): boolean => Object.keys(filters).length === 0
