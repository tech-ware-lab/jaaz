import { configs } from '@/constants'
import { authenticatedFetch } from './auth'

export interface BalanceResponse {
  balance: string
}

export async function getBalance(): Promise<BalanceResponse> {
  const response = await authenticatedFetch(
    `${configs.jaaz_base_api_url}/api/billing/getBalance`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch balance: ${response.status}`)
  }

  return await response.json()
}
