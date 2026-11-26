import { ClipboardList } from 'lucide-react'
import { useContent } from '../content-context'
import { dataString } from '../content-utils'
import { formatMoney } from '../domain/money'
import type { ReviewDraft } from '../domain/pending-queue'

/**
 * Read-only list of drafts on this register that cannot be synced as-is: no recorded owner,
 * unreadable, or set aside by their operator. Nothing here is submitted or deleted.
 */
export function ReviewDraftsPanel({ drafts }: { drafts: ReviewDraft[] }) {
  const { model, t } = useContent()
  if (drafts.length === 0) return null
  const currency = dataString(model, 'currency.code')
  const timeFormat = new Intl.DateTimeFormat(model.locale, { dateStyle: 'medium', timeStyle: 'short' })

  function detail(draft: ReviewDraft): string {
    if (draft.unitCount === null || draft.totalMinor === null || draft.createdAt === null) {
      return t('review.item.unreadableDetail')
    }
    const createdAt = new Date(draft.createdAt)
    return t(draft.unitCount === 1 ? 'review.item.detail.one' : 'review.item.detail.other', {
      units: draft.unitCount,
      amount: formatMoney(draft.totalMinor, model.locale, currency),
      time: Number.isNaN(createdAt.getTime()) ? t('review.item.timeUnknown') : timeFormat.format(createdAt),
    })
  }

  return (
    <details className="review-drafts">
      <summary>
        <ClipboardList size={16} aria-hidden="true" />
        <span>{t(drafts.length === 1 ? 'review.summary.one' : 'review.summary.other', { count: drafts.length })}</span>
      </summary>
      <p className="review-note">{t('review.note')}</p>
      <ul className="review-list">
        {drafts.map((draft, index) => (
          <li key={`${draft.reason}-${draft.createdAt ?? 'unknown'}-${index}`}>
            <strong>{t(`review.reason.${draft.reason}`)}</strong>
            <span>{detail(draft)}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
