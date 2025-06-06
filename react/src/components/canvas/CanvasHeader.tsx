import LanguageSwitcher from '@/components/common/LanguageSwitcher'
import ThemeButton from '@/components/theme/ThemeButton'
import { Input } from '@/components/ui/input'
import { useNavigate } from '@tanstack/react-router'
import { SettingsIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { LOGO_URL } from '@/constants'

type CanvasHeaderProps = {
  canvasName: string
  canvasId: string
  onNameChange: (name: string) => void
  onNameSave: () => void
}

const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  canvasName,
  canvasId,
  onNameChange,
  onNameSave,
}) => {
  const { t } = useTranslation()
  const [isLogoHovered, setIsLogoHovered] = useState(false)

  const navigate = useNavigate()

  return (
    <motion.div
      className="sticky top-0 z-0 flex w-full h-12 bg-background px-4 justify-between items-center select-none border-b border-border"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex items-center gap-2 cursor-pointer"
        onHoverStart={() => setIsLogoHovered(true)}
        onHoverEnd={() => setIsLogoHovered(false)}
        onClick={() => navigate({ to: '/' })}
      >
        <img src={LOGO_URL} alt="logo" className="size-8" draggable={false} />
        <motion.div
          className="flex relative gap-10 flex-col overflow-hidden items-start h-7 text-xl font-bold"
          style={{
            justifyContent: isLogoHovered ? 'flex-end' : 'flex-start',
          }}
        >
          <motion.span className="flex items-center" layout>
            Jaaz
          </motion.span>
          <motion.span className="flex items-center" layout aria-hidden>
            {t('canvas:back')}
          </motion.span>
        </motion.div>
      </motion.div>

      <div className="flex items-center gap-2">
        <Input
          className="text-sm text-muted-foreground text-center bg-transparent border-none shadow-none w-fit h-7 hover:bg-primary-foreground transition-all"
          value={canvasName}
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={onNameSave}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          size={'sm'}
          variant="ghost"
          onClick={() => navigate({ to: '/settings' })}
        >
          <SettingsIcon size={30} />
        </Button>
        <LanguageSwitcher />
        <ThemeButton />
      </div>
    </motion.div>
  )
}

export default CanvasHeader
