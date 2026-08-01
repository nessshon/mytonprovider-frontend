export const applyThemeColor = (): void => {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta instanceof HTMLMetaElement) {
    meta.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
  }
}

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches

export const scrollToTop = (): void => {
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" })
}

export const copyText = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const host = document.querySelector("dialog[open]") ?? document.body
    const area = document.createElement("textarea")
    area.value = value
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    host.append(area)
    area.select()

    let done = false
    try {
      done = document.execCommand("copy")
    } catch {
      done = false
    }

    area.remove()
    return done
  }
}

const SPREAD_MS = 320

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> }
}

export const spreadTheme = (origin: DOMRect, apply: () => void): void => {
  const view = document as ViewTransitionDocument

  if (reducedMotion() || typeof view.startViewTransition !== "function") {
    apply()
    return
  }

  const x = origin.left + origin.width / 2
  const y = origin.top + origin.height / 2
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

  view
    .startViewTransition(apply)
    .ready.then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: SPREAD_MS, easing: "ease-out", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => undefined)
}
