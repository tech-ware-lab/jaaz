export type ModelInfo = {
  provider: string
  model: string
  type: 'text' | 'image' | 'tool' | 'video'
  url: string
}

export async function listModels(): Promise<ModelInfo[]> {
  const response = await fetch('/api/list_models')
  return await response.json()
}
