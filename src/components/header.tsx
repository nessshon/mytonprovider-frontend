import { useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { THEME_KEY, readStored, writeStored } from "@/lib/storage"
import { applyThemeColor, scrollToTop, spreadTheme } from "@/lib/dom"
import logo from "./logo.svg"
import { IconButton } from "./icon-button"
import styles from "./header.module.css"

export default function Header() {
  const { t, i18n } = useTranslation()
  const [dark, setDark] = useState(() => document.documentElement.getAttribute("data-theme") === "dark")

  useEffect(() => {
    const root = document.documentElement
    const scheme = window.matchMedia("(prefers-color-scheme: dark)")

    const onScheme = () => {
      if (readStored(THEME_KEY)) return
      root.setAttribute("data-theme", scheme.matches ? "dark" : "light")
      applyThemeColor()
      setDark(scheme.matches)
    }

    scheme.addEventListener("change", onScheme)
    return () => scheme.removeEventListener("change", onScheme)
  }, [])

  const toggleTheme = (origin: DOMRect) => {
    const next = dark ? "light" : "dark"

    writeStored(THEME_KEY, next)
    spreadTheme(origin, () =>
      flushSync(() => {
        document.documentElement.setAttribute("data-theme", next)
        applyThemeColor()
        setDark((current) => !current)
      }),
    )
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a
          href="#top"
          className={styles.brand}
          aria-label={t("siteTitle")}
          onClick={(event) => {
            event.preventDefault()
            scrollToTop()
          }}
        >
          <img className={styles.logo} src={logo} alt="" width={36} height={36} />
          <span className={styles.title}>{t("siteTitle")}</span>
        </a>

        <span className={styles.spacer} />

        <IconButton
          size="lg"
          label={t("ui.language")}
          className={styles.language}
          onClick={() => void i18n.changeLanguage(i18n.language === "en" ? "ru" : "en")}
        >
          {i18n.language === "en" ? "RU" : "EN"}
        </IconButton>

        <IconButton
          size="lg"
          label={t("ui.theme")}
          onClick={(event) => toggleTheme(event.currentTarget.getBoundingClientRect())}
        >
          {dark ? <Sun className={styles.icon} aria-hidden="true" /> : <Moon className={styles.icon} aria-hidden="true" />}
        </IconButton>
      </div>
    </header>
  )
}
