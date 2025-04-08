"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { Chat, ChatMessage, Settings } from "@/types/chat"
import {
  getChats,
  getChatById,
  createChat,
  deleteChat,
  addMessageToChat,
  getSettings,
  updateSettings,
} from "@/app/actions/chat-actions"
import { v4 as uuidv4 } from "uuid"

// Local storage key
const SETTINGS_CACHE_KEY = "chat_app_settings"

interface ChatContextType {
  chats: Chat[]
  currentChat: Chat | null
  settings: Settings
  isLoading: boolean
  loadChats: () => Promise<void>
  selectChat: (id: string) => Promise<void>
  createNewChat: () => Promise<Chat>
  deleteCurrentChat: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  updateChatSettings: (settings: Settings) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [settings, setSettings] = useState<Settings>({ providers: [] })
  const [isLoading, setIsLoading] = useState(true)

  // Load chats and settings on mount
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true)
      try {
        const loadedChats = await getChats()
        setChats(loadedChats)

        if (loadedChats.length > 0) {
          const chat = await getChatById(loadedChats[0].id)
          setCurrentChat(chat)
        }

        // Try to load settings from localStorage first
        const cachedSettings = localStorage.getItem(SETTINGS_CACHE_KEY)

        if (cachedSettings) {
          try {
            setSettings(JSON.parse(cachedSettings))
          } catch (error) {
            console.error("Error parsing cached settings:", error)
            // If error parsing cache, load from file
            const fileSettings = await getSettings()
            setSettings(fileSettings)
          }
        } else {
          // If no cache, load from file
          const fileSettings = await getSettings()
          setSettings(fileSettings)
        }
      } catch (error) {
        console.error("Error initializing chat context:", error)
      } finally {
        setIsLoading(false)
      }
    }

    initialize()
  }, [])

  const loadChats = async () => {
    setIsLoading(true)
    try {
      const loadedChats = await getChats()
      setChats(loadedChats)
    } catch (error) {
      console.error("Error loading chats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectChat = async (id: string) => {
    setIsLoading(true)
    try {
      const chat = await getChatById(id)
      setCurrentChat(chat)
    } catch (error) {
      console.error(`Error selecting chat ${id}:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  const createNewChat = async () => {
    setIsLoading(true)
    try {
      const newChat = await createChat()
      setChats((prev) => [newChat, ...prev])
      setCurrentChat(newChat)
      return newChat
    } catch (error) {
      console.error("Error creating new chat:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const deleteCurrentChat = async () => {
    if (!currentChat) return

    setIsLoading(true)
    try {
      await deleteChat(currentChat.id)
      setChats((prev) => prev.filter((chat) => chat.id !== currentChat.id))

      if (chats.length > 1) {
        const nextChat = chats.find((chat) => chat.id !== currentChat.id)
        if (nextChat) {
          const chat = await getChatById(nextChat.id)
          setCurrentChat(chat)
        } else {
          setCurrentChat(null)
        }
      } else {
        setCurrentChat(null)
      }
    } catch (error) {
      console.error(`Error deleting chat ${currentChat.id}:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to get API key for the current model
  const getApiKeyForModel = (modelName: string): { key: string } => {
    // Find provider for the model
    for (const provider of settings.providers) {
      const models = provider.Models.split(",").map((m) => m.trim())

      if (models.includes(modelName)) {
        return { key: provider.Key }
      }
    }

    // Default to first provider if no match
    return {
      key: settings.providers[0]?.Key || "",
    }
  }

  const sendMessage = async (content: string) => {
    // Don't process empty or undefined content
    if (!content || content === "") {
      return;
    }

    if (!currentChat) {
      const newChat = await createNewChat()
      const userMessage: Omit<ChatMessage, "id" | "createdAt"> = {
        role: "user",
        content,
      }

      const updatedChat = await addMessageToChat(newChat.id, userMessage)
      if (!updatedChat) {
        // If message wasn't added (empty/undefined content), delete the new chat
        await deleteChat(newChat.id)
        return;
      }
      
      if (updatedChat) {
        setCurrentChat(updatedChat)

        // Call API to get assistant response
        try {
          const { key } = getApiKeyForModel(settings.activeModel || "")
          const model = settings.activeModel || ""
          const provider = getProviderForModel(model)

          // Create EventSource for streaming
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              conversation: updatedChat.messages,
              model: {
                name: model,
                provider: provider,
                key: key,
              },
            }),
          })

          if (!response.ok) {
            throw new Error("Failed to get response from API")
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()

          if (!reader) {
            throw new Error("No reader available")
          }

          let assistantMessage: Omit<ChatMessage, "id" | "createdAt"> = {
            role: "assistant",
            content: "",
          }

          // Create a temporary message object for streaming
          const tempMessage: ChatMessage = {
            ...assistantMessage,
            id: uuidv4(),
            createdAt: new Date().toISOString()
          }

          // Add the temporary message to the current chat state
          const initialMessages = [...updatedChat.messages, tempMessage]
          const initialChatState = {
            ...updatedChat,
            messages: initialMessages
          }
          setCurrentChat(initialChatState)

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split("\n")

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6))
                  assistantMessage.content += data.content
                  
                  // Update the chat with the modified messages array
                  const updatedMessages = initialChatState.messages.map((msg: ChatMessage) => 
                    msg.id === tempMessage.id 
                      ? { ...msg, content: assistantMessage.content }
                      : msg
                  )
                  
                  const updatedChatState = {
                    ...initialChatState,
                    messages: updatedMessages
                  }
                  
                  setCurrentChat(updatedChatState)
                } catch (e) {
                  console.error("Error parsing SSE data:", e)
                }
              }
            }
          }

          // Final update to persist in the database
          await addMessageToChat(newChat.id, {
            role: "assistant",
            content: assistantMessage.content
          })

          await loadChats()
        } catch (error) {
          console.error("Error getting assistant response:", error)
        }
      }
    } else {
      const userMessage: Omit<ChatMessage, "id" | "createdAt"> = {
        role: "user",
        content,
      }

      const updatedChat = await addMessageToChat(currentChat.id, userMessage)
      if (!updatedChat) {
        // If message wasn't added (empty/undefined content), return early
        return;
      }
      
      if (updatedChat) {
        setCurrentChat(updatedChat)

        // Call API to get assistant response
        try {
          const { key } = getApiKeyForModel(settings.activeModel || "")
          const model = settings.activeModel || ""
          const provider = getProviderForModel(model)

          // Create EventSource for streaming
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              conversation: updatedChat.messages,
              model: {
                name: model,
                provider: provider,
                key: key,
              },
            }),
          })

          if (!response.ok) {
            throw new Error("Failed to get response from API")
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()

          if (!reader) {
            throw new Error("No reader available")
          }

          let assistantMessage: Omit<ChatMessage, "id" | "createdAt"> = {
            role: "assistant",
            content: "",
          }

          // Create a temporary message object for streaming
          const tempMessage: ChatMessage = {
            ...assistantMessage,
            id: uuidv4(),
            createdAt: new Date().toISOString()
          }

          // Add the temporary message to the current chat state
          const initialMessages = [...updatedChat.messages, tempMessage]
          const initialChatState = {
            ...updatedChat,
            messages: initialMessages
          }
          setCurrentChat(initialChatState)

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split("\n")

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6))
                  assistantMessage.content += data.content
                  
                  // Update the chat with the modified messages array
                  const updatedMessages = initialChatState.messages.map((msg: ChatMessage) => 
                    msg.id === tempMessage.id 
                      ? { ...msg, content: assistantMessage.content }
                      : msg
                  )
                  
                  const updatedChatState = {
                    ...initialChatState,
                    messages: updatedMessages
                  }
                  
                  setCurrentChat(updatedChatState)
                } catch (e) {
                  console.error("Error parsing SSE data:", e)
                }
              }
            }
          }

          // Final update to persist in the database
          await addMessageToChat(currentChat.id, {
            role: "assistant",
            content: assistantMessage.content
          })

          await loadChats()
        } catch (error) {
          console.error("Error getting assistant response:", error)
        }
      }
    }
  }

  // Helper function to get provider name for the current model
  const getProviderForModel = (modelName: string): string => {
    // Find provider for the model
    for (const provider of settings.providers) {
      const models = provider.Models.split(",").map((m) => m.trim())

      if (models.includes(modelName)) {
        let providerName = provider.Provider.toLowerCase()
        if (providerName === "huggingface") return "huggingface"
        if (providerName === "openrouter") return "openrouter"
        if (providerName === "gemini") return "gemini"
        if (providerName === "ollama") return "ollama"
      }
    }

    // Default to ollama if no match
    return "ollama"
  }

  const updateChatSettings = async (newSettings: Settings) => {
    try {
      // Save to file
      await updateSettings(newSettings)

      // Save to localStorage
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(newSettings))

      setSettings(newSettings)
    } catch (error) {
      console.error("Error updating settings:", error)
    }
  }

  const value = {
    chats,
    currentChat,
    settings,
    isLoading,
    loadChats,
    selectChat,
    createNewChat,
    deleteCurrentChat,
    sendMessage,
    updateChatSettings,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}

