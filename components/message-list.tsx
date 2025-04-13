"use client"

import { useRef, useEffect, useState } from "react"
import type { ChatMessage } from "@/types/chat"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Copy, Loader2, Check, Pencil, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { MessageContent } from "@/components/message-content"
import { useChat } from "@/context/chat-context"
import { EditMessageInput } from "./edit-message-input"

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { editAndResendMessage, deleteMessagePair } = useChat()
  const [mounted, setMounted] = useState(false)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Return a simple div with the same structure while not mounted
  if (!mounted) {
    return <div className="flex-1" />
  }

  return (
    <div className="flex-1 p-4 space-y-6 pb-40">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Start a new conversation</h3>
            <p className="text-muted-foreground">Type a message below to begin</p>
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <div 
            key={message.id} 
            className={cn(
              "flex flex-col",
              message.role === "user" ? "items-end" : "items-start" 
            )}
          >
            <div
              className={cn(
                "max-w-[100%] bg-muted text-white rounded-xl px-4 py-2 break-words",
                message.role === "user" 
                  ? editingMessageId === message.id 
                    ? "w-full"
                    : "w-fit"
                  : "w-full bg-transparent"
              )}
              onMouseEnter={() => setHoveredMessageId(message.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {message.role === "assistant" && message.model && (
                <div className="text-xs opacity-100 text-muted-foreground mb-4">
                  {message.model} ({message.provider || 'unknown'})
                </div>
              )}
              {editingMessageId === message.id ? (
                <EditMessageInput 
                  initialContent={message.content}
                  messageId={message.id}
                  onSave={(id: string, newContent: string) => {
                    editAndResendMessage(id, newContent)
                    setEditingMessageId(null)
                  }}
                  onCancel={() => setEditingMessageId(null)}
                />
              ) : (
                <MessageContent content={message.content} isUser={message.role === "user"} />
              )}
              {editingMessageId !== message.id && (
                <div className="text-xs opacity-100 text-muted-foreground mt-4">{format(new Date(message.createdAt), "HH:mm")}</div>
              )}
            </div>
            
            <div className={cn("flex items-center mt-1 space-x-1")}>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "z-50 h-10 w-10 rounded-xl opacity-0 hover:opacity-100 hover:bg-muted transition-opacity duration-200",
                  (hoveredMessageId === message.id || copiedMessageId === message.id) ? "opacity-100" : "opacity-0",
                  message.role === "assistant" ? "ml-3" : ""
                )}
                onClick={() => {
                  navigator.clipboard.writeText(message.content)
                  setCopiedMessageId(message.id)
                  setTimeout(() => setCopiedMessageId(null), 1000)
                }}
              >
                {copiedMessageId === message.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>

              {message.role === 'user' && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "z-50 h-10 w-10 rounded-xl opacity-0 hover:opacity-100 hover:bg-muted transition-opacity duration-200",
                    hoveredMessageId === message.id ? "opacity-100" : "opacity-0"
                  )}
                  onClick={() => {
                    setEditingMessageId(message.id)
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}

              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "z-50 h-10 w-10 rounded-xl opacity-0 hover:opacity-100 hover:bg-muted transition-opacity duration-200",
                  hoveredMessageId === message.id ? "opacity-100" : "opacity-0"
                )}
                onClick={() => deleteMessagePair(message.id)}
                title="Delete Message Pair"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      )}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-muted max-w-[80%] rounded-xl px-4 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}


