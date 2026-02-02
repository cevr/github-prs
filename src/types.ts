export interface PR {
  id: number
  number: number
  title: string
  html_url: string
  repository_url: string
  updated_at: string
  user: { login: string }
  isApproved?: boolean
  lastUpdatedBy?: string
}

export interface PRData {
  created: PR[]
  assigned: PR[]
}

export interface SeenPRs {
  [key: string]: string
}

export interface OptionsData {
  token: string
  username: string
  checkInterval: number
  hideInactivePRs: boolean
}
