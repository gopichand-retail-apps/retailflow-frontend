import { CircleHelp, Clock, Wifi, WifiOff } from 'lucide-react'
import { useContent } from '../content-context'

interface StoreHeaderProps {
  activeLabel: string
  today: string
  online: boolean
  onHelp: () => void
}

function ConnectionStatus({ online }: { online: boolean }) {
  const { t } = useContent()
  const Icon = online ? Wifi : WifiOff

  return (
    <span className={online ? 'connection-pill' : 'connection-pill is-offline'}>
      <Icon size={14} aria-hidden="true" />
      {online ? t('status.online') : t('status.offline')}
    </span>
  )
}

export function StoreHeader({ activeLabel, today, online, onHelp }: StoreHeaderProps) {
  const { t } = useContent()

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>{t('page.storeOperations')}</span>
        <span>/</span>
        <strong>{activeLabel}</strong>
      </div>
      <div className="topbar-actions">
        <ConnectionStatus online={online} />
        <span className="topbar-date">
          <Clock size={15} />
          {today}
        </span>
        <button
          className="icon-button help-button"
          type="button"
          title={t('help.title')}
          aria-label={t('help.title')}
          onClick={onHelp}
        >
          <CircleHelp size={18} />
        </button>
      </div>
    </header>
  )
}

export function StoreFooter() {
  const { t } = useContent()

  return (
    <footer className="main-footer">
      <span>{t('footer.build')}</span>
      <span>{t('footer.safety')}</span>
    </footer>
  )
}
