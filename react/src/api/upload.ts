export async function uploadImage(
  file: File
): Promise<{ file_id: string; width: number; height: number; url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/upload_image', {
    method: 'POST',
    body: formData,
  })
  return await response.json()
}
