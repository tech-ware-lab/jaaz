import { BASE_API_URL } from '../constants'
import { authenticatedFetch } from './auth'

// 知识库基本信息接口
export interface KnowledgeBase {
  id: string
  user_id: string
  name: string
  description: string | null
  cover: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  content?: string // Optional, not always returned for performance
}

// 分页信息接口
export interface Pagination {
  current_page: number
  page_size: number
  total_count: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

// 获取知识库列表的响应接口
export interface KnowledgeListResponse {
  success: boolean
  data: {
    list: KnowledgeBase[]
    pagination: Pagination
    is_admin: boolean
  }
  message: string
}

// 获取知识库列表的请求参数接口
export interface KnowledgeListParams {
  pageSize?: number
  pageNumber?: number
  search?: string
}

// API响应基础接口
export interface ApiResponse {
  success: boolean
  message: string
  error?: string
  details?: string
}

/**
 * 获取知识库列表
 * @param params 查询参数
 * @returns Promise<KnowledgeListResponse>
 */
export async function getKnowledgeList(
  params: KnowledgeListParams = {}
): Promise<KnowledgeListResponse> {
  const { pageSize = 10, pageNumber = 1, search } = params

  // 构建查询参数
  const queryParams = new URLSearchParams({
    pageSize: pageSize.toString(),
    pageNumber: pageNumber.toString(),
  })

  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }

  try {
    const response = await authenticatedFetch(
      `${BASE_API_URL}/api/knowledge/list?${queryParams.toString()}`
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to get knowledge list:', error)
    throw new Error(
      error instanceof Error ? error.message : 'Failed to get knowledge list'
    )
  }
}

/**
 * 获取单个知识库详情
 * @param id 知识库ID
 * @returns Promise<KnowledgeBase>
 */
export async function getKnowledgeById(id: string): Promise<KnowledgeBase> {
  try {
    const response = await authenticatedFetch(
      `${BASE_API_URL}/api/knowledge/${id}`
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Failed to get knowledge by id:', error)
    throw new Error(
      error instanceof Error ? error.message : 'Failed to get knowledge base'
    )
  }
}

/**
 * 创建知识库
 * @param knowledgeData 知识库数据
 * @returns Promise<ApiResponse>
 */
export async function createKnowledge(knowledgeData: {
  name: string
  description?: string
  cover?: string
  is_public?: boolean
  content?: string
}): Promise<ApiResponse> {
  try {
    const response = await authenticatedFetch(
      `${BASE_API_URL}/api/knowledge/create`,
      {
        method: 'POST',
        body: JSON.stringify(knowledgeData),
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to create knowledge:', error)
    throw new Error(
      error instanceof Error ? error.message : 'Failed to create knowledge base'
    )
  }
}

/**
 * 更新知识库
 * @param id 知识库ID
 * @param knowledgeData 更新数据
 * @returns Promise<ApiResponse>
 */
export async function updateKnowledge(
  id: string,
  knowledgeData: Partial<{
    name: string
    description: string
    cover: string
    is_public: boolean
    content: string
  }>
): Promise<ApiResponse> {
  try {
    const response = await authenticatedFetch(
      `${BASE_API_URL}/api/knowledge/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(knowledgeData),
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to update knowledge:', error)
    throw new Error(
      error instanceof Error ? error.message : 'Failed to update knowledge base'
    )
  }
}

/**
 * 删除知识库
 * @param id 知识库ID
 * @returns Promise<ApiResponse>
 */
export async function deleteKnowledge(id: string): Promise<ApiResponse> {
  try {
    const response = await authenticatedFetch(
      `${BASE_API_URL}/api/knowledge/${id}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to delete knowledge:', error)
    throw new Error(
      error instanceof Error ? error.message : 'Failed to delete knowledge base'
    )
  }
}

// Local storage key for enabled knowledge bases
const ENABLED_KNOWLEDGE_KEY = 'jaaz_enabled_knowledge'

/**
 * 获取客户端已启用的知识库ID列表
 * @returns string[] 已启用的知识库ID数组
 */
export function getEnabledKnowledgeIds(): string[] {
  try {
    const saved = localStorage.getItem(ENABLED_KNOWLEDGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch (error) {
    console.error('Failed to parse enabled knowledge:', error)
    return []
  }
}

/**
 * 保存已启用的知识库ID列表
 * @param knowledgeIds 知识库ID数组
 */
export function saveEnabledKnowledgeIds(knowledgeIds: string[]): void {
  localStorage.setItem(ENABLED_KNOWLEDGE_KEY, JSON.stringify(knowledgeIds))
}

/**
 * 检查指定知识库是否已启用
 * @param knowledgeId 知识库ID
 * @returns boolean
 */
export function isKnowledgeEnabled(knowledgeId: string): boolean {
  const enabledIds = getEnabledKnowledgeIds()
  return enabledIds.includes(knowledgeId)
}
