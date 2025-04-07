"use server"

import fs from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import type { Chat, ChatMessage, Settings, ProviderConfig } from "@/types/chat"

const DATA_DIR = path.join(process.cwd(), "data")
const CHATS_DIR = path.join(DATA_DIR, "chats")
const SETTINGS_FILE = path.join(process.cwd(), "app_config.json")

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.mkdir(CHATS_DIR, { recursive: true })
  } catch (error) {
    console.error("Error creating directories:", error)
  }
}

// Get all chats
export async function getChats(): Promise<Chat[]> {
  await ensureDirectories()

  try {
    const files = await fs.readdir(CHATS_DIR)
    const chatFiles = files.filter((file) => file.endsWith(".json"))

    const chats = await Promise.all(
      chatFiles.map(async (file) => {
        const content = await fs.readFile(path.join(CHATS_DIR, file), "utf-8")
        return JSON.parse(content) as Chat
      }),
    )

    return chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch (error) {
    console.error("Error reading chats:", error)
    return []
  }
}

// Get a single chat by ID
export async function getChatById(id: string): Promise<Chat | null> {
  try {
    const content = await fs.readFile(path.join(CHATS_DIR, `${id}.json`), "utf-8")
    return JSON.parse(content) as Chat
  } catch (error) {
    console.error(`Error reading chat ${id}:`, error)
    return null
  }
}

// Create a new chat
export async function createChat(title = "New Chat"): Promise<Chat> {
  await ensureDirectories()

  const newChat: Chat = {
    id: uuidv4(),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await fs.writeFile(path.join(CHATS_DIR, `${newChat.id}.json`), JSON.stringify(newChat, null, 2))

  return newChat
}

// Update a chat
export async function updateChat(chat: Chat): Promise<Chat> {
  chat.updatedAt = new Date().toISOString()

  await fs.writeFile(path.join(CHATS_DIR, `${chat.id}.json`), JSON.stringify(chat, null, 2))

  return chat
}

// Delete a chat
export async function deleteChat(id: string): Promise<boolean> {
  try {
    await fs.unlink(path.join(CHATS_DIR, `${id}.json`))
    return true
  } catch (error) {
    console.error(`Error deleting chat ${id}:`, error)
    return false
  }
}

// Add a message to a chat
export async function addMessageToChat(
  chatId: string,
  message: Omit<ChatMessage, "id" | "createdAt">,
): Promise<Chat | null> {
  const chat = await getChatById(chatId)
  if (!chat) return null

  const newMessage: ChatMessage = {
    ...message,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  }

  chat.messages.push(newMessage)
  chat.updatedAt = new Date().toISOString()

  // Update chat title if it's the first user message
  if (chat.title === "New Chat" && message.role === "user") {
    chat.title = message.content.slice(0, 15) + (message.content.length > 15 ? "..." : "")
  }

  await updateChat(chat)
  return chat
}

// Get settings
export async function getSettings(): Promise<Settings> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, "utf-8")
    const providers = JSON.parse(content) as ProviderConfig[]

    return {
      providers,
    }
  } catch (error) {
    // Return default settings if file doesn't exist
    const defaultSettings: Settings = {
      providers: [],
    }

    return defaultSettings
  }
}

// Update settings
export async function updateSettings(settings: Settings): Promise<Settings> {
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings.providers, null, 2))
    return settings
  } catch (error) {
    console.error("Error updating settings:", error)
    throw error
  }
}

