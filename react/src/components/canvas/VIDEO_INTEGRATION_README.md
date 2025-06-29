# 视频模块重构说明

## 概述

本次重构将视频功能从独立的覆盖层系统迁移到 Excalidraw 的原生嵌入式元素系统，通过 `ExcalidrawElementSkeleton` 和 `renderEmbeddable` 实现更好的性能和用户体验。

## 主要变更

### 1. 新的视频嵌入架构

- **ExcalidrawElementSkeleton**: 使用 Excalidraw 的骨架元素系统创建嵌入式视频元素
- **renderEmbeddable**: 自定义渲染函数，将视频 URL 渲染为 iframe 播放器
- **原生集成**: 视频现在作为 Excalidraw 的原生元素，支持所有标准操作（移动、缩放、删除等）

### 2. 核心组件

#### CanvasExcali.tsx

- 添加了 `createVideoEmbedElement` 函数
- 实现了 `renderEmbeddable` 自定义渲染
- 集成了视频生成事件处理
- 启用了 Excalidraw 的嵌入工具

#### VideoEmbedComponent.tsx

- 新的视频添加组件
- 支持文件上传和 URL 输入
- 提供用户友好的界面

### 3. 功能特性

#### 视频格式支持

- MP4
- WebM
- OGG
- Blob URLs（本地文件）

#### 交互功能

- 拖拽移动
- 缩放调整
- 删除操作
- 复制粘贴
- 选择和多选

#### 播放控制

- 内置播放控件
- 自动播放（静音）
- 循环播放
- 音量控制

## 使用方法

### 1. 通过 VideoEmbedComponent 添加视频

```tsx
// 在 canvas.$id.tsx 中已集成
<VideoEmbedComponent />
```

### 2. 通过代码添加视频

```tsx
import { useCanvas } from '@/contexts/canvas'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

const { excalidrawAPI } = useCanvas()

// 创建视频嵌入元素
const videoElements = convertToExcalidrawElements([
  {
    type: 'embeddable',
    x: 100,
    y: 100,
    width: 320,
    height: 180,
    link: 'https://example.com/video.mp4',
    validated: true,
  },
])

// 添加到画布
const currentElements = excalidrawAPI.getSceneElements()
excalidrawAPI.updateScene({
  elements: [...currentElements, ...videoElements],
})
```

### 3. 通过 Excalidraw 工具栏

1. 点击工具栏中的嵌入工具（📎）
2. 输入视频 URL
3. 确认添加

## 技术实现

### renderEmbeddable 函数

```tsx
const renderEmbeddable = useCallback(
  (element: NonDeleted<ExcalidrawEmbeddableElement>, appState: AppState) => {
    const { link } = element

    // 检查是否为视频 URL
    if (
      link &&
      (link.includes('.mp4') ||
        link.includes('.webm') ||
        link.includes('.ogg') ||
        link.startsWith('blob:'))
    ) {
      return (
        <iframe
          src={`data:text/html;charset=utf-8,
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { margin: 0; padding: 0; background: black; }
                  video { width: 100%; height: 100%; object-fit: contain; }
                </style>
              </head>
              <body>
                <video controls autoplay muted loop>
                  <source src="${link}" type="video/mp4">
                  Your browser does not support the video tag.
                </video>
              </body>
            </html>`}
          width="100%"
          height="100%"
          style={{
            border: 'none',
            borderRadius: '8px',
            background: '#000',
          }}
          title="Video Player"
        />
      )
    }

    return null
  },
  []
)
```

### 事件处理

```tsx
// 处理视频生成事件
const handleVideoGenerated = useCallback(
  (videoData: ISocket.SessionVideoGeneratedEvent) => {
    if (videoData.canvas_id !== canvasId) return

    if (videoData.video_url) {
      createVideoEmbedElement(videoData.video_url, 100, 100, 320, 180)
    }
  },
  [createVideoEmbedElement, canvasId]
)
```

## 性能优化

### 1. 减少 DOM 层级

- 移除独立的视频覆盖层
- 视频直接作为 Excalidraw 元素渲染

### 2. 内存管理

- 使用 iframe 隔离视频播放器
- 自动清理 blob URLs

### 3. 渲染优化

- 利用 Excalidraw 的虚拟化渲染
- 只渲染可见区域的视频

## 兼容性

### 浏览器支持

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### 视频格式

- H.264 (MP4)
- VP8/VP9 (WebM)
- Theora (OGG)

## 迁移指南

### 从旧系统迁移

1. **移除旧的 VideoCanvasOverlay 使用**（可选）
2. **使用新的 VideoEmbedComponent**
3. **更新事件处理逻辑**

### 数据迁移

现有的视频数据可以通过以下方式迁移：

```tsx
// 将旧的视频数据转换为嵌入元素
const migrateVideoData = (oldVideoData: VideoElement[]) => {
  return oldVideoData.map((video) => ({
    type: 'embeddable',
    x: video.x,
    y: video.y,
    width: video.width,
    height: video.height,
    link: video.src,
    validated: true,
  }))
}
```

## 故障排除

### 常见问题

1. **视频不显示**

   - 检查视频 URL 是否有效
   - 确认视频格式支持
   - 检查网络连接

2. **性能问题**

   - 减少同时播放的视频数量
   - 使用较小的视频文件
   - 考虑使用视频预览图

3. **CORS 错误**
   - 确保视频服务器支持跨域访问
   - 使用相同域名的视频资源

### 调试

启用控制台日志查看详细信息：

```tsx
console.log('👇 Video embed element added:', videoSrc)
console.log('👇 CanvasExcali received video_generated:', videoData)
```

## 未来计划

- [ ] 支持更多视频格式
- [ ] 添加视频预览缩略图
- [ ] 实现视频时间轴控制
- [ ] 支持视频字幕
- [ ] 添加视频滤镜效果
