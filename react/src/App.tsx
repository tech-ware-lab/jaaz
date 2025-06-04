import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { useTheme } from '@/hooks/use-theme'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { routeTree } from './route-tree.gen'

import '@/assets/style/App.css'

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
        <div className="app-container">
          <RouterProvider router={router} />
        </div>
      </QueryClientProvider>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
