import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Image,
  Play,
  File,
  Home,
  ArrowLeft,
  Search,
  Grid,
  List,
  RefreshCw,
  FileText,
  Music,
  Archive,
  Code,
  Eye,
  Download,
  Star,
  Heart,
  MoreHorizontal,
  ExternalLink,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import {
  browseFolderApi,
  getMediaFilesApi,
  getFileServiceUrl,
  openFolderInExplorer,
} from '@/api/settings'
import FilePreviewModal from './FilePreviewModal'

interface FileSystemItem {
  name: string
  path: string
  type: string
  size?: number
  mtime: number
  is_directory: boolean
  is_media: boolean
  has_thumbnail: boolean
}

interface BrowseResult {
  current_path: string
  parent_path: string | null
  items: FileSystemItem[]
}

export default function MaterialManager() {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [pathHistory, setPathHistory] = useState<string[]>([])
  const [items, setItems] = useState<FileSystemItem[]>([])
  const [mediaFiles, setMediaFiles] = useState<FileSystemItem[]>([])
  const [selectedFolder, setSelectedFolder] = useState<FileSystemItem | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [folderContents, setFolderContents] = useState<
    Map<string, FileSystemItem[]>
  >(new Map())
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean
    filePath: string
    fileName: string
    fileType: string
  }>({
    isOpen: false,
    filePath: '',
    fileName: '',
    fileType: '',
  })

  // 初始化时加载用户目录
  useEffect(() => {
    loadFolder('')
  }, [])

  const loadFolder = useCallback(
    async (path: string = '') => {
      setLoading(true)
      setError(null)

      try {
        const result: BrowseResult = await browseFolderApi(path)
        setCurrentPath(result.current_path)
        setItems(result.items)

        // 将当前路径的内容添加到folderContents中
        setFolderContents((prev) =>
          new Map(prev).set(result.current_path, result.items)
        )

        // 如果选择了文件夹，加载媒体文件
        if (selectedFolder && selectedFolder.is_directory) {
          try {
            const mediaResult = await getMediaFilesApi(selectedFolder.path)
            setMediaFiles(mediaResult)
          } catch (err) {
            console.error('Failed to load media files:', err)
          }
        }
      } catch (err) {
        setError('Failed to load folder')
        console.error('Error loading folder:', err)
      } finally {
        setLoading(false)
      }
    },
    [selectedFolder]
  )

  const loadFolderContents = useCallback(async (folderPath: string) => {
    try {
      const result: BrowseResult = await browseFolderApi(folderPath)
      setFolderContents((prev) => new Map(prev).set(folderPath, result.items))
      return result.items
    } catch (err) {
      console.error('Failed to load folder contents:', err)
      return []
    }
  }, [])

  const navigateToFolder = useCallback(
    (folder: FileSystemItem) => {
      if (folder.is_directory) {
        setPathHistory((prev) => [...prev, currentPath])
        setCurrentPath(folder.path)
        setSelectedFolder(folder)
        loadFolder(folder.path)
      }
    },
    [currentPath, loadFolder]
  )

  const navigateBack = useCallback(() => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1]
      setPathHistory((prev) => prev.slice(0, -1))
      setCurrentPath(previousPath)
      loadFolder(previousPath)
    }
  }, [pathHistory, loadFolder])

  const handleFolderClick = useCallback(
    async (folder: FileSystemItem) => {
      if (folder.is_directory) {
        setSelectedFolder(folder)

        // Toggle expansion state
        setExpandedFolders((prev) => {
          const newSet = new Set(prev)
          if (newSet.has(folder.path)) {
            newSet.delete(folder.path)
          } else {
            newSet.add(folder.path)
          }
          return newSet
        })

        // Load folder contents if not already loaded
        if (!folderContents.has(folder.path)) {
          await loadFolderContents(folder.path)
        }

        try {
          const mediaResult = await getMediaFilesApi(folder.path)
          setMediaFiles(mediaResult)
        } catch (err) {
          console.error('Failed to load media files:', err)
          setMediaFiles([])
        }
      }
    },
    [folderContents, loadFolderContents]
  )

  const toggleFolder = useCallback(
    async (folderId: string) => {
      const isExpanded = expandedFolders.has(folderId)

      setExpandedFolders((prev) => {
        const newSet = new Set(prev)
        if (isExpanded) {
          newSet.delete(folderId)
        } else {
          newSet.add(folderId)
        }
        return newSet
      })

      // 如果是展开操作且还没有加载内容，则加载
      if (!isExpanded && !folderContents.has(folderId)) {
        await loadFolderContents(folderId)
      }
    },
    [expandedFolders, folderContents, loadFolderContents]
  )

  const handlePreviewFile = useCallback((file: FileSystemItem) => {
    if (file.is_media) {
      setPreviewModal({
        isOpen: true,
        filePath: file.path,
        fileName: file.name,
        fileType: file.type,
      })
    }
  }, [])

  const closePreviewModal = useCallback(() => {
    setPreviewModal({
      isOpen: false,
      filePath: '',
      fileName: '',
      fileType: '',
    })
  }, [])

  const handleOpenInExplorer = useCallback(async () => {
    if (selectedFolder) {
      try {
        await openFolderInExplorer(selectedFolder.path)
      } catch (error) {
        console.error('Failed to open folder in explorer:', error)
      }
    }
  }, [selectedFolder])

  const getFileIcon = useCallback(
    (type: string, className: string = 'w-4 h-4') => {
      switch (type) {
        case 'folder':
          return <Folder className={className} />
        case 'image':
          return <Image className={`${className} text-blue-500`} />
        case 'video':
          return <Play className={`${className} text-red-500`} />
        case 'audio':
          return <Music className={`${className} text-green-500`} />
        case 'document':
          return <FileText className={`${className} text-orange-500`} />
        case 'archive':
          return <Archive className={`${className} text-purple-500`} />
        case 'code':
          return <Code className={`${className} text-yellow-500`} />
        default:
          return <File className={className} />
      }
    },
    []
  )

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }, [])

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredMediaFiles = mediaFiles.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 递归搜索所有文件夹内容
  const searchInFolderContents = useCallback(
    (items: FileSystemItem[], term: string): FileSystemItem[] => {
      if (!term) return items

      return items.filter((item) => {
        const nameMatches = item.name.toLowerCase().includes(term.toLowerCase())
        if (nameMatches) return true

        // 如果是文件夹且已展开，搜索子内容
        if (item.is_directory && expandedFolders.has(item.path)) {
          const childItems = folderContents.get(item.path) || []
          return searchInFolderContents(childItems, term).length > 0
        }

        return false
      })
    },
    [expandedFolders, folderContents]
  )

  const getFilteredFolderContents = useCallback(
    (path: string): FileSystemItem[] => {
      const contents = folderContents.get(path) || []
      return searchTerm
        ? searchInFolderContents(contents, searchTerm)
        : contents
    },
    [folderContents, searchTerm, searchInFolderContents]
  )

  const renderFileTree = useCallback(
    (items: FileSystemItem[], depth = 0) => {
      return items.map((item) => (
        <div key={item.path} className={`select-none`}>
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 ${
              selectedFolder?.path === item.path && item.is_directory
                ? 'bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500'
                : item.is_media && !item.is_directory
                  ? 'hover:bg-green-50 dark:hover:bg-green-950'
                  : ''
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() =>
              item.is_directory
                ? handleFolderClick(item)
                : handlePreviewFile(item)
            }
          >
            {item.is_directory && (
              <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                {expandedFolders.has(item.path) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            )}

            {!item.is_directory && (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-3 h-3"></div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-1">
              {item.is_directory ? (
                expandedFolders.has(item.path) ? (
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                ) : (
                  <Folder className="w-4 h-4 text-gray-600" />
                )
              ) : (
                getFileIcon(item.type)
              )}
              <span className="text-sm font-medium truncate" title={item.name}>
                {item.name}
              </span>
            </div>

            {/* 文件大小显示 */}
            {!item.is_directory && item.size && (
              <span className="text-xs text-gray-400 ml-2">
                {formatFileSize(item.size)}
              </span>
            )}
          </div>

          {/* 递归渲染子文件夹和文件 */}
          {item.is_directory && expandedFolders.has(item.path) && (
            <div className="ml-2">
              {getFilteredFolderContents(item.path).length > 0 &&
                renderFileTree(getFilteredFolderContents(item.path), depth + 1)}
            </div>
          )}
        </div>
      ))
    },
    [
      selectedFolder,
      expandedFolders,
      folderContents,
      handleFolderClick,
      handlePreviewFile,
      navigateToFolder,
      toggleFolder,
      getFileIcon,
      formatFileSize,
      getFilteredFolderContents,
    ]
  )

  const renderMediaGrid = useCallback(() => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredMediaFiles.map((file) => (
          <div
            key={file.path}
            className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center overflow-hidden">
              {file.type === 'image' ? (
                <img
                  src={getFileServiceUrl(file.path)}
                  alt={file.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove(
                      'hidden'
                    )
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  {getFileIcon(file.type, 'w-8 h-8')}
                  <span className="text-xs mt-1">
                    {file.type.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="hidden flex flex-col items-center justify-center text-gray-400">
                {getFileIcon(file.type, 'w-8 h-8')}
                <span className="text-xs mt-1">{file.type.toUpperCase()}</span>
              </div>
            </div>

            {/* Hover overlay */}
            {/* <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                <button
                  onClick={() => handlePreviewFile(file)}
                  className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:scale-110 transition-transform"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:scale-110 transition-transform">
                  <Heart className="w-4 h-4" />
                </button>
                <button className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:scale-110 transition-transform">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div> */}

            <div className="p-3">
              <div className="text-sm font-medium truncate" title={file.name}>
                {file.name}
              </div>
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>{formatFileSize(file.size || 0)}</span>
                <span>{formatDate(file.mtime)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }, [
    filteredMediaFiles,
    getFileIcon,
    formatFileSize,
    formatDate,
    handlePreviewFile,
  ])

  const renderMediaList = useCallback(() => {
    return (
      <div className="space-y-2 w-full overflow-hidden">
        {filteredMediaFiles.map((file) => (
          <div
            key={file.path}
            className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow min-w-0"
          >
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {file.type === 'image' ? (
                <img
                  src={getFileServiceUrl(file.path)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove(
                      'hidden'
                    )
                  }}
                />
              ) : (
                getFileIcon(file.type)
              )}
              <div className="hidden">{getFileIcon(file.type)}</div>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="font-medium truncate">{file.name}</div>
              <div className="text-sm text-gray-500 flex items-center gap-4 overflow-hidden">
                <span className="whitespace-nowrap">
                  {formatFileSize(file.size || 0)}
                </span>
                <span className="whitespace-nowrap">
                  {formatDate(file.mtime)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handlePreviewFile(file)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="预览"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Heart className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }, [
    filteredMediaFiles,
    getFileIcon,
    formatFileSize,
    formatDate,
    handlePreviewFile,
  ])

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 w-full overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Home className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold">素材库</h3>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={navigateBack}
              disabled={pathHistory.length === 0}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">
              {currentPath || '~'}
            </div>
            <button
              onClick={() => loadFolder(currentPath)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {/* Search */}
          {/* <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索文件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div> */}
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-1">{renderFileTree(filteredItems)}</div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedFolder ? selectedFolder.name : '选择文件夹'}
                </h2>
                {selectedFolder && (
                  <button
                    onClick={handleOpenInExplorer}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="在系统文件浏览器中打开"
                  >
                    <ExternalLink className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
              </div>
              {selectedFolder && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {filteredMediaFiles.length} 个媒体文件
                </p>
              )}
            </div>

            {selectedFolder && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 w-full min-w-0">
          {selectedFolder ? (
            <div className="w-full overflow-hidden">
              {filteredMediaFiles.length > 0 ? (
                viewMode === 'grid' ? (
                  renderMediaGrid()
                ) : (
                  renderMediaList()
                )
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Image className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">没有找到媒体文件</p>
                    <p className="text-sm mt-2">该文件夹中没有图片或视频文件</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Folder className="w-20 h-20 mx-auto mb-6 opacity-30" />
                <p className="text-xl font-medium">选择一个文件夹</p>
                <p className="text-sm mt-2">
                  在左侧选择文件夹以查看其中的图片和视频
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={previewModal.isOpen}
        onClose={closePreviewModal}
        filePath={previewModal.filePath}
        fileName={previewModal.fileName}
        fileType={previewModal.fileType}
      />
    </div>
  )
}
