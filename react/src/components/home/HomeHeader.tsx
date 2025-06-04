import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { MoonIcon, SunIcon } from 'lucide-react'
import { motion } from 'motion/react'

function HomeHeader() {
  const { setTheme, theme } = useTheme()

  return (
    <motion.div
      className="sticky top-0 z-0 flex w-full h-15 bg-background px-4 justify-between items-center select-none"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2">
        <img
          src="/unicorn.png"
          alt="logo"
          className="w-10 h-10"
          draggable={false}
        />
        <p className="text-2xl font-bold">Jaaz</p>
      </div>
      <Button
        size={'sm'}
        variant={'ghost'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <SunIcon size={30} /> : <MoonIcon size={30} />}
      </Button>
    </motion.div>
  )
}

export default HomeHeader
