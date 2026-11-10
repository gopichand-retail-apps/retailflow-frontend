import { useEffect, useState } from 'react'
import { api, ApiFailure, type DemoRole, type DemoUser } from './api'
import type { ContentModel, Translate } from './content-schema'
import { errorMessage } from './error-message'

export function useDemoSession(model: ContentModel, t: Translate) {
  const [user, setUser] = useState<DemoUser | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [roles, setRoles] = useState<DemoRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [rolesError, setRolesError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setRolesLoading(true)
    api
      .demoRoles()
      .then(({ roles: serverRoles }) => {
        if (active) {
          setRoles(serverRoles)
          setRolesError(null)
        }
      })
      .catch((error: unknown) => {
        if (active) setRolesError(errorMessage(error, t, model.messages))
      })
      .finally(() => {
        if (active) setRolesLoading(false)
      })

    return () => {
      active = false
    }
  }, [model.messages, t])

  useEffect(() => {
    let active = true
    api
      .me()
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser)
      })
      .catch((error: unknown) => {
        if (active && (!(error instanceof ApiFailure) || error.status !== 401)) {
          setRolesError(errorMessage(error, t, model.messages))
        }
      })
      .finally(() => {
        if (active) setSessionLoading(false)
      })

    return () => {
      active = false
    }
  }, [model.messages, t])

  return { user, setUser, sessionLoading, roles, rolesLoading, rolesError }
}
