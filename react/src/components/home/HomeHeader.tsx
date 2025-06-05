import ThemeButton from '@/components/theme/ThemeButton'
import { motion } from 'motion/react'

function HomeHeader() {
  return (
    <motion.div
      className="sticky top-0 z-0 flex w-full h-12 bg-background px-4 justify-between items-center select-none"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2">
        <img
          src="/unicorn.png"
          alt="logo"
          className="size-8"
          draggable={false}
        />
        <p className="text-xl font-bold">Jaaz</p>
      </div>
      <ThemeButton />
    </motion.div>
  )
}

export default HomeHeader
