import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { startDeviceAuth, pollDeviceAuth, saveAuthData } from '../../api/auth'
import { updateJaazApiKey } from '../../api/config'
import { useAuth } from '../../contexts/AuthContext'
import { useConfigs, useRefreshModels } from '../../contexts/configs'

export function LoginDialog() {
  const [isLoading, setIsLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const { refreshAuth } = useAuth()
  const { showLoginDialog: open, setShowLoginDialog } = useConfigs()
  const refreshModels = useRefreshModels()
  const { t } = useTranslation()
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up polling when dialog closes
  useEffect(() => {
    if (!open) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      setIsLoading(false)
      setAuthMessage('')
    }
  }, [open])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const startPolling = (code: string) => {
    console.log('Starting polling for device code:', code)

    const poll = async () => {
      try {
        const result = await pollDeviceAuth(code)
        console.log('Poll result:', result)

        if (result.status === 'authorized') {
          // Login successful - save auth data to local storage
          if (result.token && result.user_info) {
            saveAuthData(result.token, result.user_info)

            // Update jaaz provider api_key with the access token
            await updateJaazApiKey(result.token)
          }

          setAuthMessage(t('common:auth.loginSuccessMessage'))
          setIsLoading(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          try {
            await refreshAuth()
            console.log('Auth status refreshed successfully')
            // Refresh models list after successful login and config update
            refreshModels()
          } catch (error) {
            console.error('Failed to refresh auth status:', error)
          }

          setTimeout(() => setShowLoginDialog(false), 1500)

        } else if (result.status === 'expired') {
          // Authorization expired
          setAuthMessage(t('common:auth.authExpiredMessage'))
          setIsLoading(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

        } else if (result.status === 'error') {
          // Error occurred
          setAuthMessage(result.message || t('common:auth.authErrorMessage'))
          setIsLoading(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

        } else {
          // Still pending, continue polling
          setAuthMessage(t('common:auth.waitingForBrowser'))
        }
      } catch (error) {
        console.error('Polling error:', error)
        setAuthMessage(t('common:auth.pollErrorMessage'))
        setIsLoading(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }

    // Start polling immediately, then every 1 seconds
    poll()
    pollingIntervalRef.current = setInterval(poll, 1000)
  }

  const handleLogin = async () => {
    try {
      setIsLoading(true)
      setAuthMessage(t('common:auth.preparingLoginMessage'))

      const result = await startDeviceAuth()
      setAuthMessage(result.message)

      // Start polling for authorization status
      startPolling(result.code)

    } catch (error) {
      console.error('登录请求失败:', error)
      setAuthMessage(t('common:auth.loginRequestFailed'))
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsLoading(false)
    setAuthMessage('')
    setShowLoginDialog(false)
  }

  return (
    <Dialog open={open} onOpenChange={setShowLoginDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('common:auth.loginToJaaz')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('common:auth.loginDescription')}
          </p>

          {authMessage && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">{authMessage}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? t('common:auth.preparingLogin') : t('common:auth.startLogin')}
            </Button>

            {isLoading && (
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1"
              >
                {t('common:auth.cancel')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
