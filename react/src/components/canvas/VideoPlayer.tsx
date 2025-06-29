import React, { useRef, useEffect, useState } from 'react'

interface VideoPlayerProps {
  src: string
  width?: string | number
  height?: string | number
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, width = '100%', height = '100%' }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const handleLoadStart = () => {
    setIsLoading(true)
    setHasError(false)
  }

  const handleCanPlay = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = () => {
    console.error('Video loading error for:', src)
    setIsLoading(false)
    setHasError(true)
    
    // Auto retry up to 3 times
    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1)
        if (videoRef.current) {
          videoRef.current.load()
        }
      }, 1000)
    }
  }

  const handleRetry = () => {
    setRetryCount(0)
    setHasError(false)
    setIsLoading(true)
    if (videoRef.current) {
      videoRef.current.load()
    }
  }

  useEffect(() => {
    // Reset states when src changes
    setIsLoading(true)
    setHasError(false)
    setRetryCount(0)
  }, [src])

  return (
    <div 
      style={{
        width,
        height,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      {isLoading && !hasError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: '14px',
          zIndex: 2
        }}>
          加载中...
        </div>
      )}
      
      {hasError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: '14px',
          textAlign: 'center',
          zIndex: 2
        }}>
          <div>视频加载失败</div>
          <button 
            onClick={handleRetry}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              background: '#007acc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            重试
          </button>
        </div>
      )}
      
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        playsInline
        muted
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: hasError ? 'none' : 'block'
        }}
      />
    </div>
  )
}

export default VideoPlayer