# Jaaz Workspaces Setup

This project uses npm workspaces to enable component sharing between the `@jaaz/agent-ui` React library and the `jaaz-cloud` Next.js application.

## ✅ **Completed Setup**

### 1. **Workspace Configuration**

- ✅ Added `workspaces` configuration to root `package.json`
- ✅ Configured `react` and `jaaz-cloud` as workspace packages
- ✅ Set up dependency linking between packages

### 2. **@jaaz/agent-ui Package Configuration**

- ✅ Created comprehensive `src/index.ts` export file with:
  - **Chat Components**: `ChatInterface`, `ChatTextarea`, `ChatHistory`, etc.
  - **UI Components**: `Button`, `Dialog`, `DropdownMenu`, `Select`, `Avatar`, etc.
  - **Contexts & Hooks**: `AuthProvider`, `useAuth`, `useConfigs`, `useDebounce`, etc.
  - **Types**: `Message`, `Session`, `Model`, `ModelInfo`, etc.
  - **Utils**: `cn`, `eventBus`, `formatDate`, etc.

- ✅ Updated `package.json` for library export:
  - Removed `private: true`
  - Added proper `main`, `module`, `types`, and `exports` configuration
  - Added `build:lib` script for library builds

- ✅ Created TypeScript declaration file (`src/index.d.ts`) for proper type exports

- ✅ Configured Vite for library builds:
  - Added library mode configuration
  - Externalized dependencies (React, etc.)
  - Configured proper output format
  - Includes TypeScript declarations in build output

### 3. **jaaz-cloud Integration**

- ✅ Added `@jaaz/agent-ui` as dependency using `file:../react`
- ✅ Created example component showing usage: `jaaz-cloud/src/components/examples/ChatExample.tsx`

### 4. **Documentation**

- ✅ Created comprehensive `README-workspaces.md` with:
  - Setup instructions
  - Usage examples
  - Development workflow
  - Available exports
  - Troubleshooting guide

## 🚀 **Usage Example**

You can now use components from `@jaaz/agent-ui` in your `jaaz-cloud` project:

```typescript
// Import components
import { ChatInterface, Button, Dialog } from '@jaaz/agent-ui'
import type { Message, Session } from '@jaaz/agent-ui'

// Use in your component
export default function MyPage() {
  return (
    <div>
      <ChatInterface
        canvasId="example"
        sessionList={[]}
        setSessionList={() => {}}
        sessionId="test"
      />
      <Button>Click me</Button>
    </div>
  )
}
```

## 📝 **Development Workflow**

1. **Install dependencies** (from root):

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Build the library** (when making changes):

   ```bash
   cd react
   npm run build:lib
   ```

3. **Use in jaaz-cloud**:
   ```bash
   cd jaaz-cloud
   npm run dev
   ```

## 📋 **Current Status & Notes**

- ✅ **Workspace linking**: Works properly
- ✅ **Component exports**: All major components exported
- ✅ **Library build**: Successfully builds ES modules
- ✅ **TypeScript declarations**: Properly exported with the library
- ⚠️ **Styling**: CSS is exported but may need additional Tailwind configuration in consuming project

The setup is fully functional for sharing components between packages with proper TypeScript support. You can now successfully import and use `ChatInterface` and other components from `@jaaz/agent-ui` in your `jaaz-cloud` project! 🎉
