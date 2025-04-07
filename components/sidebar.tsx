"use client"

import { useState, useEffect } from "react"
import { useChat } from "@/context/chat-context"
import { Button } from "@/components/ui/button"
import { PlusCircle, MessageSquare, Settings, Trash2, X } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface SidebarProps {
  onClose: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { chats, currentChat, createNewChat, selectChat, deleteCurrentChat } = useChat()
  const isMobile = useMobile()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNewChat = async () => {
    await createNewChat()
    if (isMobile) onClose()
  }

  const handleSelectChat = async (id: string) => {
    await selectChat(id)
    if (isMobile) onClose()
  }

  const handleSettings = () => {
    router.push("/settings")
    if (isMobile) onClose()
  }

  // Return a simple div with the same structure while not mounted
  if (!mounted) {
    return <div className="flex flex-col h-full p-4" />
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">AI Chat</h1>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <Button className="mb-4 justify-start" variant="outline" onClick={handleNewChat}>
        <PlusCircle className="mr-2 h-4 w-4" />
        New Chat
      </Button>

      <div className="flex-1 overflow-auto">
        <div className="space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                "flex items-center w-full px-3 py-2 rounded-md group",
                currentChat?.id === chat.id
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-muted/50"
              )}
            >
              <div
                role="button"
                className="flex items-center flex-1 min-w-0 cursor-pointer"
                onClick={() => handleSelectChat(chat.id)}
              >
                <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{chat.title}</span>
              </div>
              {currentChat?.id === chat.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteCurrentChat()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {chats.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No chats yet. Start a new conversation!</p>
          )}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-border">
        <Button variant="ghost" className="w-full justify-start" onClick={handleSettings}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  )
}

