export async function listModels(): Promise<
  {
    provider: string
    model: string
    type: string
    url: string
  }[]
> {
  const response = await fetch('/api/list_models')
  return await response.json()
}
