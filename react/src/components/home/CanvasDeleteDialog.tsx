import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { Button } from '../ui/button'

type CanvasDeleteDialogProps = {
  show: boolean
  className?: string
  children?: React.ReactNode
  setShow: (show: boolean) => void
  handleDeleteCanvas: () => void
}

const CanvasDeleteDialog: React.FC<CanvasDeleteDialogProps> = ({
  show,
  className,
  children,
  setShow,
  handleDeleteCanvas,
}) => {
  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogTrigger asChild>
        {children ? (
          children
        ) : (
          <Button variant="destructive" size="icon" className={className}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Canvas</DialogTitle>
        </DialogHeader>

        <DialogDescription>
          Are you sure you want to delete this Canvas? This action cannot be
          undone.
        </DialogDescription>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShow(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => handleDeleteCanvas()}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CanvasDeleteDialog
