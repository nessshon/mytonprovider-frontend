import { useCallback, useEffect, useState } from "react"

const PUBKEY = /^[0-9a-f]{64}$/i

const base = import.meta.env.BASE_URL

const pubkeyOf = (path: string): string | null => {
  const rest = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, "")
  const candidate = rest.replace(/\/$/, "")
  return PUBKEY.test(candidate) ? candidate.toLowerCase() : null
}

const readPubkey = (): string | null => pubkeyOf(window.location.pathname)

export const useOpenProvider = (): [string | null, (pubkey: string | null) => void] => {
  const [pubkey, setPubkey] = useState<string | null>(readPubkey)

  useEffect(() => {
    const current = readPubkey()
    if (current !== null && window.location.pathname !== `${base}${current}`) {
      window.history.replaceState(null, "", `${base}${current}${window.location.search}`)
    }
  }, [])

  useEffect(() => {
    const onPop = () => setPubkey(readPubkey())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const open = useCallback((next: string | null) => {
    const path = next ? `${base}${next}` : base
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", `${path}${window.location.search}`)
    }
    setPubkey(next)
  }, [])

  return [pubkey, open]
}
