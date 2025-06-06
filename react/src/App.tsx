import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { useTheme } from '@/hooks/use-theme'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { routeTree } from './route-tree.gen'

import '@/assets/style/App.css'
import InstallComfyUIDialog from '@/components/comfyui/InstallComfyUIDialog'
import UpdateNotificationDialog from '@/components/common/UpdateNotificationDialog'
import { ConfigsProvider } from '@/contexts/configs'
import '@/i18n'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient()

function App() {
  const { theme } = useTheme()

  return (
    <ThemeProvider defaultTheme={theme} storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <ConfigsProvider>
          <div className="app-container">
            <RouterProvider router={router} />

            {/* Install ComfyUI Dialog */}
            <InstallComfyUIDialog />

            {/* Update Notification Dialog */}
            <UpdateNotificationDialog />
          </div>
        </ConfigsProvider>
      </QueryClientProvider>
      <Toaster position="bottom-center" />
    </ThemeProvider>
  )
}

export default App
