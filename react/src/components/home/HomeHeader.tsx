import ThemeButton from '@/components/theme/ThemeButton'
import LanguageSwitcher from '@/components/common/LanguageSwitcher'
import { SettingsIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '../ui/button'
import { useNavigate } from '@tanstack/react-router'
import { LOGO_URL } from '@/constants'

function HomeHeader() {
  const navigate = useNavigate()

  return (
    <motion.div
      className="sticky top-0 z-0 flex w-full h-12 bg-background px-4 justify-between items-center select-none"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2">
        <img src={LOGO_URL} alt="logo" className="size-8" draggable={false} />
        <p className="text-xl font-bold">Jaaz</p>
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

export default HomeHeader
