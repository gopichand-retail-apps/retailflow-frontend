import { useState } from 'react'
import { Activity, Check, CircleHelp, LoaderCircle, ShieldCheck, ShoppingBag, Store } from 'lucide-react'
import type { DemoRole } from '../api'
import { useContent } from '../content-context'
import { dataString } from '../content-utils'
import { errorMessage } from '../error-message'

interface LoginScreenProps {
  onLogin: (role: DemoRole) => Promise<void>
  roles: DemoRole[]
  rolesLoading: boolean
  rolesError: string | null
}

export function LoginScreen({ onLogin, roles, rolesLoading, rolesError }: LoginScreenProps) {
  const { model, t } = useContent()
  const [busyRole, setBusyRole] = useState<DemoRole | null>(null)
  const [error, setError] = useState('')

  async function login(role: DemoRole): Promise<void> {
    setBusyRole(role)
    setError('')
    try {
      await onLogin(role)
    } catch (loginError) {
      setError(errorMessage(loginError, t, model.messages))
    } finally {
      setBusyRole(null)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-brand-panel" aria-label={t('login.panelLabel')}>
        <div className="brand-lockup">
          <span className="brand-mark">
            <Store size={20} />
          </span>
          <span>{t('brand.name')}</span>
        </div>
        <div className="login-brand-copy">
          <div className="eyebrow">{t('environment.loginEyebrow')}</div>
          <h1>
            {t('login.titleLead')}
            <br />
            <em>{t('login.titleEmphasis')}</em>
          </h1>
          <p>{t('login.description')}</p>
        </div>
        <div className="login-sample-ticket" aria-hidden="true">
          <span className="ticket-stamp">
            <Check size={15} />
          </span>
          <span className="ticket-lines">
            <i />
            <i />
            <i />
          </span>
          <span className="ticket-total">{dataString(model, 'receipt.sampleTotal')}</span>
        </div>
        <p className="login-disclaimer">{t('environment.disclaimer')}</p>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <span className="local-access">
            <ShieldCheck size={15} /> {t('login.access')}
          </span>
          <h2>{t('login.chooseRole')}</h2>
          <p className="login-intro">{t('login.permissions')}</p>
          {rolesLoading ? (
            <p className="login-intro" role="status" aria-busy="true">
              {t('login.loadingRoles')}
            </p>
          ) : rolesError ? (
            <p className="form-error" role="alert">
              {rolesError}
            </p>
          ) : (
            <div className="role-options">
              {roles.map((role) => (
                <button
                  className="role-option"
                  type="button"
                  key={role}
                  aria-label={t('login.roleButtonLabel', {
                    role: t(`login.role.${role === 'store_admin' ? 'storeAdmin' : role}`),
                    description: t(`login.roleDescription.${role === 'store_admin' ? 'storeAdmin' : role}`),
                  })}
                  disabled={busyRole !== null}
                  onClick={() => void login(role)}
                >
                  <span className={`role-icon role-${role}`}>
                    {role === 'cashier' ? (
                      <ShoppingBag size={19} />
                    ) : role === 'supervisor' ? (
                      <Activity size={19} />
                    ) : (
                      <ShieldCheck size={19} />
                    )}
                  </span>
                  <span>
                    <strong>{t(`login.role.${role === 'store_admin' ? 'storeAdmin' : role}`)}</strong>
                    <small>{t(`login.roleDescription.${role === 'store_admin' ? 'storeAdmin' : role}`)}</small>
                  </span>
                  {busyRole === role ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <span className="role-arrow">{t('login.open')}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="local-only-note">
            <CircleHelp size={15} /> {t('login.productionDisabled')}
          </p>
        </div>
      </section>
    </main>
  )
}
