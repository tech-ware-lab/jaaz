export async function getConfigExists(): Promise<{ exists: boolean }> {
  const response = await fetch('/api/config/exists')
  return await response.json()
}
