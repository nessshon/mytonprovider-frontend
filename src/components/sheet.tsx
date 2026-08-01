import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { IconButton } from "./icon-button"
import styles from "./sheet.module.css"

interface SheetProps {
  open: boolean
  label: string
  title?: string
  badge?: number
  footer?: ReactNode
  children: ReactNode
  onReset?: () => void
  onClose: () => void
}

export const Sheet = ({ open, label, title, badge, footer, children, onReset, onClose }: SheetProps) => {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    const cancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }

    dialog.addEventListener("cancel", cancel)
    return () => dialog.removeEventListener("cancel", cancel)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-label={label}
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      <div className={styles.header}>
        {title && <span className={styles.title}>{title}</span>}
        {badge !== undefined && badge > 0 && <span className={styles.badge}>{badge}</span>}
        <span className={styles.spacer} />
        {onReset && (
          <button type="button" className={styles.reset} onClick={onReset}>
            {t("buttons.reset")}
          </button>
        )}
        <IconButton label={t("ui.close")} onClick={onClose}>
          <X className={styles.closeIcon} />
        </IconButton>
      </div>

      <div className={styles.body}>{children}</div>

      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  )
}
