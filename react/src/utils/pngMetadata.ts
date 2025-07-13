/**
 * PNG Metadata Reader - 前端直接读取PNG文件的metadata
 *
 * PNG文件格式：
 * - PNG signature: 8字节
 * - Chunks: 每个chunk包含长度(4字节) + 类型(4字节) + 数据 + CRC(4字节)
 * - 文本信息存储在tEXt、zTXt、iTXt chunks中
 */

interface PngChunk {
  length: number
  type: string
  data: Uint8Array
  crc: number
}

interface PngMetadata {
  success: boolean
  metadata: Record<string, any>
  has_metadata: boolean
  error?: string
}

/**
 * 从ArrayBuffer中读取4字节big-endian整数
 */
function readUint32BE(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]
  )
}

/**
 * 从ArrayBuffer中读取字符串
 */
function readString(
  buffer: Uint8Array,
  offset: number,
  length: number
): string {
  return new TextDecoder('utf-8').decode(buffer.slice(offset, offset + length))
}

/**
 * 检查PNG文件头
 */
function isPNG(buffer: Uint8Array): boolean {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buffer.length < 8) return false

  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== pngSignature[i]) return false
  }
  return true
}

/**
 * 解析PNG chunks
 */
function parsePNGChunks(buffer: Uint8Array): PngChunk[] {
  const chunks: PngChunk[] = []
  let offset = 8 // 跳过PNG signature

  while (offset < buffer.length - 8) {
    const length = readUint32BE(buffer, offset)
    const type = readString(buffer, offset + 4, 4)

    if (offset + 12 + length > buffer.length) break

    const data = buffer.slice(offset + 8, offset + 8 + length)
    const crc = readUint32BE(buffer, offset + 8 + length)

    chunks.push({ length, type, data, crc })

    offset += 12 + length

    // 如果遇到IEND chunk，停止解析
    if (type === 'IEND') break
  }

  return chunks
}

/**
 * 解析tEXt chunk
 */
function parseTextChunk(data: Uint8Array): [string, string] | null {
  try {
    const text = new TextDecoder('latin1').decode(data)
    const nullIndex = text.indexOf('\0')
    if (nullIndex === -1) return null

    const keyword = text.substring(0, nullIndex)
    const value = text.substring(nullIndex + 1)

    return [keyword, value]
  } catch (error) {
    console.error('Error parsing tEXt chunk:', error)
    return null
  }
}

/**
 * 解析zTXt chunk (压缩文本)
 */
function parseZTextChunk(data: Uint8Array): [string, string] | null {
  try {
    const text = new TextDecoder('latin1').decode(data)
    const nullIndex = text.indexOf('\0')
    if (nullIndex === -1) return null

    const keyword = text.substring(0, nullIndex)
    // 跳过compression method byte
    const compressedData = data.slice(nullIndex + 2)

    // 这里需要zlib解压缩，为了简化我们先跳过zTXt
    console.warn('zTXt chunk found but decompression not implemented')
    return [keyword, '[Compressed Text - Not Implemented]']
  } catch (error) {
    console.error('Error parsing zTXt chunk:', error)
    return null
  }
}

/**
 * 解析iTXt chunk (国际化文本)
 */
function parseITextChunk(data: Uint8Array): [string, string] | null {
  try {
    let offset = 0
    const text = new TextDecoder('utf-8').decode(data)

    // 查找第一个null字符（keyword结束）
    const keywordEnd = text.indexOf('\0')
    if (keywordEnd === -1) return null

    const keyword = text.substring(0, keywordEnd)
    offset = keywordEnd + 1

    // 跳过compression flag和compression method
    offset += 2

    // 查找language tag结束
    const languageEnd = text.indexOf('\0', offset)
    if (languageEnd === -1) return null
    offset = languageEnd + 1

    // 查找translated keyword结束
    const translatedEnd = text.indexOf('\0', offset)
    if (translatedEnd === -1) return null
    offset = translatedEnd + 1

    // 剩余的就是文本内容
    const value = text.substring(offset)

    return [keyword, value]
  } catch (error) {
    console.error('Error parsing iTXt chunk:', error)
    return null
  }
}

/**
 * 从PNG文件中提取metadata
 */
export async function readPNGMetadata(filePath: string): Promise<PngMetadata> {
  try {
    // 获取文件
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // 检查是否为PNG文件
    if (!isPNG(buffer)) {
      return {
        success: false,
        metadata: {},
        has_metadata: false,
        error: 'Not a valid PNG file',
      }
    }

    // 解析PNG chunks
    const chunks = parsePNGChunks(buffer)
    const metadata: Record<string, any> = {}

    // 处理文本chunks
    for (const chunk of chunks) {
      let result: [string, string] | null = null

      switch (chunk.type) {
        case 'tEXt':
          result = parseTextChunk(chunk.data)
          break
        case 'zTXt':
          result = parseZTextChunk(chunk.data)
          break
        case 'iTXt':
          result = parseITextChunk(chunk.data)
          break
      }

      if (result) {
        const [key, value] = result
        try {
          // 尝试解析JSON
          if (value.startsWith('{') || value.startsWith('[')) {
            metadata[key] = JSON.parse(value)
          } else {
            metadata[key] = value
          }
        } catch (e) {
          metadata[key] = value
        }
      }
    }

    return {
      success: true,
      metadata,
      has_metadata: Object.keys(metadata).length > 0,
    }
  } catch (error) {
    console.error('Error reading PNG metadata:', error)
    return {
      success: false,
      metadata: {},
      has_metadata: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 检查文件是否为PNG格式
 */
export async function isPNGFile(filePath: string): Promise<boolean> {
  try {
    const response = await fetch(filePath, {
      headers: { Range: 'bytes=0-7' }, // 只获取前8字节
    })

    if (!response.ok) return false

    const arrayBuffer = await response.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    return isPNG(buffer)
  } catch (error) {
    console.error('Error checking PNG file:', error)
    return false
  }
}
