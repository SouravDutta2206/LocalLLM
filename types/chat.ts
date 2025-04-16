export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
  model?: string
  provider?: string
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  model?: string
}

export interface ProviderConfig {
  Provider: string
  Key: string
  Models: string
}

export interface Settings {
  providers: ProviderConfig[]
  activeModel?: string
  activeProvider?: string
}
