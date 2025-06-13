import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoginDialog } from './LoginDialog'
import { logout } from '@/api/auth'

export function UserMenu() {
  const { authStatus, refreshAuth } = useAuth()
  const { t } = useTranslation()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    await refreshAuth()
  }

  // 如果用户已登录，显示用户菜单
  if (authStatus.is_logged_in && authStatus.user_info) {
    const { username, image_url } = authStatus.user_info
    const initials = username ? username.substring(0, 2).toUpperCase() : 'U'

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={image_url} alt={username} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('common:auth.myAccount')}</DropdownMenuLabel>
          <DropdownMenuItem disabled>{username}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            {t('common:auth.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // 未登录状态，显示登录按钮
  return (
    <>
      <Button variant="outline" onClick={() => setLoginDialogOpen(true)}>
        {t('common:auth.login')}
      </Button>
      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
      />
    </>
  )
}
