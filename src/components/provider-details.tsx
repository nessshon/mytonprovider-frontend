import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { ProviderDetail, SectionId } from "@/types/model"
import { CopyButton } from "./copy-button"
import { SECTION_ICONS } from "./section-icons"
import styles from "./provider-details.module.css"
import { cx } from "@/lib/cx"

interface ProviderDetailsProps {
  detail: ProviderDetail
  copiedKey: string | null
  onCopy: (value: string) => void
}

interface SectionProps {
  id: SectionId
  title: string
  children: ReactNode
}

const Section = ({ id, title, children }: SectionProps) => {
  const Icon = SECTION_ICONS[id]

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <Icon className={styles.sectionIcon} aria-hidden="true" />
        <span className={styles.sectionName}>{title}</span>
      </h2>

      <div className={styles.rows}>{children}</div>
    </section>
  )
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
        {detail.sections.map((section) => (
          <Section key={section.id} id={section.id} title={section.title}>
            {section.fields.map((field) => (
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
                {field.copy && (
                  <CopyButton
                    value={field.copy}
                    copied={copiedKey === field.copy}
                    onCopy={onCopy}
                    className={styles.copy}
                  />
                )}
              </div>
            ))}
          </Section>
        ))}
      </div>
    </div>
  )
}

const SKELETON_SECTIONS: { id: SectionId; label: string; rows: number; copies: number }[] = [
  { id: "provider", label: "provider.providerTitle", rows: 11, copies: 2 },
  { id: "software", label: "provider.software", rows: 2, copies: 2 },
  { id: "benchmarks", label: "provider.benchmarks", rows: 2, copies: 0 },
  { id: "hardware", label: "provider.hardware", rows: 5, copies: 0 },
  { id: "network", label: "provider.network", rows: 5, copies: 0 },
]

const LABEL_WIDTHS = ["5.5em", "7em", "4.5em", "6.5em", "5em"]
const VALUE_WIDTHS = ["6em", "4em", "8em", "5em", "7em"]

const line = (width: string) => ({ "--shape-w": width }) as React.CSSProperties

export const ProviderDetailsSkeleton = () => {
  const { t } = useTranslation()

  return (
    <div className={styles.details} aria-hidden="true">
      <div className={styles.statusCard}>
        <div className={styles.bar}>
          <span className={cx(styles.barSegment, styles.shape)} style={{ flexGrow: 1 }} />
        </div>

        <div className={styles.statusBody}>
          <div className={styles.statusMain}>
            <div className={styles.statusLabel}>
              <span className={cx(styles.shape, styles.shapeDot)} />
              <span className={cx(styles.statusText, styles.shape, styles.shapeLine)} style={line("6em")}>
                &nbsp;
              </span>
            </div>
            <p className={styles.description}>
              <span className={cx(styles.shape, styles.shapeLine)} style={line("22em")}>
                &nbsp;
              </span>
            </p>
          </div>

          <div className={styles.checks}>
            <div className={styles.checksRow}>
              <span className={cx(styles.checksLabel, styles.shape, styles.shapeLine)} style={line("6.5em")}>
                &nbsp;
              </span>
              <span className={cx(styles.badgeTotal, styles.shape, styles.shapeLine)} style={line("4em")}>
                &nbsp;
              </span>
            </div>
            <span className={cx(styles.toggle, styles.shape, styles.shapeLine)} style={line("7em")}>
              &nbsp;
            </span>
          </div>
        </div>
      </div>

      <div className={styles.groups}>
        {SKELETON_SECTIONS.map((section) => (
          <Section key={section.id} id={section.id} title={t(section.label)}>
            {Array.from({ length: section.rows }, (_, index) => (
              <div key={index} className={styles.row}>
                <span
                  className={cx(styles.rowLabel, styles.shape, styles.shapeLine)}
                  style={line(LABEL_WIDTHS[index % LABEL_WIDTHS.length] ?? "5em")}
                >
                  &nbsp;
                </span>
                <span className={styles.spacer} />
                <span
                  className={cx(styles.rowValue, styles.shape, styles.shapeLine)}
                  style={line(VALUE_WIDTHS[index % VALUE_WIDTHS.length] ?? "6em")}
                >
                  &nbsp;
                </span>
                {index < section.copies && <span className={cx(styles.copy, styles.shape, styles.shapeCopy)} />}
              </div>
            ))}
          </Section>
        ))}
      </div>
    </div>
  )
}
