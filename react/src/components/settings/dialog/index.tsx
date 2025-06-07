import CommonDialogContent from '@/components/common/DialogContent'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useConfigs } from '@/contexts/configs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SettingProviders from './providers'
import SettingSidebar, { SettingSidebarType } from './sidebar'

const SettingsDialog = () => {
  const { showSettingsDialog: open, setShowSettingsDialog } = useConfigs()
  const { t } = useTranslation()
  const [current, setCurrent] = useState<SettingSidebarType>('provider')

  return (
    <Dialog open={open} onOpenChange={setShowSettingsDialog}>
      <CommonDialogContent
        open={open}
        transformPerspective={6000}
        className="flex flex-col max-w-[min(1200px,80vw)]! min-w-[600px]! max-h-[80vh]! p-0"
      >
        <SidebarProvider className="h-full min-h-full flex-1 relative">
          <SettingSidebar current={current} setCurrent={setCurrent} />
          <ScrollArea className="max-h-[80vh]! w-full">
            <SettingProviders />
          </ScrollArea>
        </SidebarProvider>

        <DialogFooter className="flex-shrink-0 p-2 border-t border-border/50">
          <Button
            onClick={() => setShowSettingsDialog(false)}
            variant={'outline'}
          >
            {t('settings:close')}
          </Button>
        </DialogFooter>
      </CommonDialogContent>
    </Dialog>
  )
}

export default SettingsDialog
