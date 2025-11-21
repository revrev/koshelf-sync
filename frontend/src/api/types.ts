export interface AccountSummary {
  username: string
  documents: number
}

export interface AccountsResponse {
  accounts: AccountSummary[]
  admin?: string | null
  actor_is_admin?: boolean
  bootstrap_allowed?: boolean
  can_create?: boolean
}
