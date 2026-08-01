import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { ProviderDetail } from "@/types/model"
import { CopyButton } from "./copy-button"
import { SECTION_ICONS } from "./section-icons"
import styles from "./provider-details.module.css"
import { cx } from "@/lib/cx"

interface ProviderDetailsProps {
  detail: ProviderDetail
  copiedKey: string | null
  onCopy: (value: string) => void
}

export const ProviderDetails = ({ detail, copiedKey, onCopy }: ProviderDetailsProps) => {
  const { t } = useTranslation()
  const [showLegend, setShowLegend] = useState(false)

  return (
    <div className={styles.details}>
      <div className={styles.statusCard} data-tone={detail.status.tone}>
        {detail.breakdown.length > 0 && (
          <div className={styles.bar}>
            {detail.breakdown.map((item) => (
              <span
                key={item.id}
                className={styles.barSegment}
                data-tone={item.tone}
                style={{ flexGrow: item.count }}
                title={`${item.label} • ${item.count}`}
              />
            ))}
          </div>
        )}

        <div className={styles.statusBody}>
          <div className={styles.statusMain}>
            <div className={styles.statusLabel}>
              <span className={styles.dot} />
              <span className={styles.statusText}>{detail.status.label}</span>
            </div>
            <p className={styles.description}>{detail.description}</p>
          </div>

          {detail.checks && (
            <div className={styles.checks}>
              <div className={styles.checksRow}>
                <span className={styles.checksLabel}>{t("status.filesAvailable")}</span>
                <span className={styles.checksValue}>
                  <span className={styles.badgeValid} data-tone={detail.checks.tone}>
                    {detail.checks.valid}
                  </span>
                  <span className={styles.slash}>/</span>
                  <span className={styles.badgeTotal}>{detail.checks.total}</span>
                </span>
              </div>
              <button type="button" className={styles.toggle} onClick={() => setShowLegend((open) => !open)}>
                {t(showLegend ? "status.hideDetails" : "status.showDetails")}
              </button>
            </div>
          )}
        </div>

        {showLegend && detail.breakdown.length > 0 && (
          <div className={styles.legend}>
            {detail.breakdown.map((item) => (
              <div key={item.id} className={styles.legendRow} data-tone={item.tone}>
                <span className={styles.legendDot} />
                <span className={styles.legendLabel}>{item.label}</span>
                <span className={styles.spacer} />
                <span className={styles.legendMeta}>
                  {item.count} • {item.percent}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.groups}>
        {detail.sections.map((section) => {
          const Icon = SECTION_ICONS[section.id]

          return (
            <section key={section.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <Icon className={styles.sectionIcon} aria-hidden="true" />
                <span className={styles.sectionName}>{section.title}</span>
              </h2>

              <div className={styles.rows}>
                {section.fields.map((field) => {
                  const copyValue = field.copy
                  return (
                  <div key={field.label} className={styles.row}>
                    <span className={styles.rowLabel}>{field.label}</span>
                    <span className={styles.spacer} />
                    {field.href ? (
                      <a
                        className={cx(styles.rowValue, field.mono && styles.mono)}
                        href={field.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={field.title}
                      >
                        {field.value}
                      </a>
                    ) : (
                      <span
                        className={cx(
                          styles.rowValue,
                          field.uppercase && styles.uppercase,
                          field.alert && styles.alert,
                          field.mono && styles.mono,
                        )}
                        title={field.title}
                      >
                        {field.value}
                      </span>
                    )}
                    {copyValue && (
                      <CopyButton
                        value={copyValue}
                        copied={copiedKey === copyValue}
                        onCopy={onCopy}
                        className={styles.copy}
                      />
                    )}
                  </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
