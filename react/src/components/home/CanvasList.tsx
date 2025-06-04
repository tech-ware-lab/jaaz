import { listCanvases } from '@/api/canvas'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'

const CanvasList: React.FC = () => {
  const { data: canvases } = useQuery({
    queryKey: ['canvases'],
    queryFn: listCanvases,
  })

  const navigate = useNavigate()
  const handleCanvasClick = (id: string) => {
    navigate({ to: '/canvas/$id', params: { id } })
  }

  return (
    <div className="flex flex-col px-10 mt-10 gap-4 select-none">
      {canvases && canvases.length > 0 && (
        <motion.span
          className="text-2xl font-bold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          All Projects
        </motion.span>
      )}

      <AnimatePresence>
        <div className="grid grid-cols-4 gap-4 w-full pb-10">
          {canvases?.map((canvas) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              key={canvas.id}
              className="border border-primary/20 rounded-xl p-3 flex flex-col gap-2 cursor-pointer hover:border-primary/40 transition-all duration-300 hover:shadow-md hover:bg-primary/5 active:scale-99"
              onClick={() => handleCanvasClick(canvas.id)}
            >
              {canvas.thumbnail ? (
                <img
                  src={canvas.thumbnail}
                  alt={canvas.name}
                  className="w-full h-40 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-40 bg-primary/20 rounded-lg" />
              )}
              <div className="flex flex-col">
                <h3 className="text-lg font-bold">{canvas.name}</h3>
                <p className="text-sm text-gray-500">{canvas.created_at}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  )
}

export default CanvasList
