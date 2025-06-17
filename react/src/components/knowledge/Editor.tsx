import { useEffect, useRef, useState, useCallback } from 'react'
import '@mdxeditor/editor/style.css'
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  type MDXEditorProps,
  BoldItalicUnderlineToggles,
  UndoRedo,
  toolbarPlugin,
  InsertTable,
  InsertImage,
  Separator,
  CodeToggle,
  ListsToggle,
  CreateLink,
  BlockTypeSelect,
  linkPlugin,
  imagePlugin,
} from '@mdxeditor/editor'

import { toast } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { ImagePlusIcon } from 'lucide-react'
import { Button } from '../ui/button'

type MediaFile = {
  path: string
  type: 'image' | 'video'
  name: string
}

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )
}

export default function Editor({
  curPath,
  setCurPath,
}: {
  curPath: string
  setCurPath: (path: string) => void
}) {
  const HEADER_HEIGHT = 50
  const { theme } = useTheme()
  const [isTextSelected, setIsTextSelected] = useState(false)
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const mdxEditorRef = useRef<MDXEditorMethods>(null)
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])

  useEffect(() => {
    setIsLoading(true)
    fetch('/api/read_file', {
      method: 'POST',
      body: JSON.stringify({ path: curPath }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.content == 'string') {
          const { title, content } = getTitleAndContent(data.content)
          setEditorTitle(title)
          setEditorContent(content)
          mdxEditorRef.current?.setMarkdown(content)
          setIsLoading(false)
        } else {
          toast.error('Failed to read file ' + curPath)
        }
      })
  }, [curPath])

  const renameFile = useCallback(
    (title: string) => {
      const fullContent = `# ${title}\n${editorContent}`
      fetch('/api/rename_file', {
        method: 'POST',
        body: JSON.stringify({ old_path: curPath, new_title: title }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.path) {
            // successfully renamed, update to the new path
            await fetch('/api/update_file', {
              method: 'POST',
              body: JSON.stringify({ path: data.path, content: fullContent }),
            })
            setCurPath(data.path)
            dispatchEvent(new CustomEvent('refresh_workspace'))
          } else {
            // failed to rename, update to the old path
            await fetch('/api/update_file', {
              method: 'POST',
              body: JSON.stringify({ path: curPath, content: fullContent }),
            })
            toast.error(data.error)
          }
        })
        .finally(() => {
          setIsLoading(false)
        })
    },
    [curPath, editorContent, setCurPath]
  )

  const updateFile = useCallback(
    (content: string) => {
      const fullContent = `# ${editorTitle}\n${content}`
      fetch('/api/update_file', {
        method: 'POST',
        body: JSON.stringify({ path: curPath, content: fullContent }),
      })
    },
    [curPath, editorTitle]
  )

  // Create debounced versions of the functions
  const debouncedRenameFile = useDebounce(renameFile, 500)
  const debouncedUpdateFile = useDebounce(updateFile, 500)

  const setEditorTitleWrapper = (title: string) => {
    setEditorTitle(title)
    debouncedRenameFile(title)
  }

  const setEditorContentWrapper = (content: string) => {
    setEditorContent(content)
    debouncedUpdateFile(content)
  }

  useEffect(() => {
    const toolbar = document.querySelector('.my-classname')
    if (toolbar) {
      ;(toolbar as HTMLElement).style.padding = '0px'
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)

        // Ensure that there's a non-empty selection
        if (!range.collapsed) {
          const rect = range.getBoundingClientRect()
          setSelectionPosition({ top: rect.top - 50, left: rect.left })
          setIsTextSelected(true)
        } else {
          setIsTextSelected(false) // No selection or collapsed selection
        }
      } else {
        setIsTextSelected(false) // No selection
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])

  const handleImageUpload = (file: File) => {
    return new Promise((resolve, reject) => {})
  }
  return (
    <div className="mb-5">
      <div
        className="flex py-2 items-center gap-2"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <Switch checked={isPreviewMode} onCheckedChange={setIsPreviewMode} />
        <span className="text-sm">Preview</span>
      </div>
      <div
        style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}
        className="overflow-y-auto border rounded-md"
      >
        {!isPreviewMode ? (
          <Textarea
            placeholder="Post content"
            className="text-sm flex-1 h-[calc(100vh-200px)]"
            value={editorContent}
            onChange={(e) => setEditorContentWrapper(e.target.value)}
          />
        ) : (
          <MDXEditor
            ref={mdxEditorRef}
            className={theme == 'dark' ? `dark-theme` : ''}
            plugins={[
              headingsPlugin(),
              linkPlugin(),
              imagePlugin({
                imageUploadHandler: (file) => handleImageUpload(file),
                imageAutocompleteSuggestions: [
                  'https://picsum.photos/200/300',
                  'https://picsum.photos/200',
                ],
              }),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              toolbarPlugin({
                toolbarClassName: 'my-classname',
                toolbarPosition: 'top',
                toolbarContents: () => (
                  <>
                    {
                      <div
                        role="toolbar"
                        className="flex rounded-md"
                        // style={{
                        //   top: `${selectionPosition.top}px`,
                        //   left: `${selectionPosition.left}px`,
                        // }}
                      >
                        <BoldItalicUnderlineToggles />
                        <BlockTypeSelect />
                        {/* <CodeToggle /> */}
                        <Separator orientation="vertical" />
                        <CreateLink />
                        <Button
                          variant={'ghost'}
                          onClick={() => {
                            const input = document.createElement('input')
                            input.type = 'file'
                            input.accept = 'image/*'

                            input.onchange = async () => {
                              const file = input.files?.[0]
                              if (!file) return
                              console.log('selected file', file)

                              handleImageUpload(file)
                            }

                            input.click()
                          }}
                        >
                          <ImagePlusIcon />
                        </Button>
                      </div>
                    }
                  </>
                ),
              }),
            ]}
            onChange={(t) => {
              setEditorContentWrapper(t)
            }}
            placeholder={`Write your post here...`}
            markdown={editorContent}
          />
        )}
      </div>
    </div>
  )
}

function getTitleAndContent(value: string) {
  const firstNewlineIndex = value.indexOf('\n')
  if (firstNewlineIndex !== -1 && value.startsWith('# ')) {
    const title = value.substring(2, firstNewlineIndex).trim() // Extract title without '# '
    const content = value.substring(firstNewlineIndex + 1).trim() // Extract content after the first newline
    console.log('content', content)
    return { title, content }
  }
  return { title: '', content: value }
}
