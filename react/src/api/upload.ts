export async function uploadImage(
  file: File,
  sessionId: string
): Promise<{ file_id: string; width: number; height: number }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('session_id', sessionId)
  const response = await fetch('/api/upload_image', {
    method: 'POST',
    body: formData,
  })
  return await response.json()
}
