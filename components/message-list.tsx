"use client"

import { useRef, useEffect, useState } from "react"
import type { ChatMessage } from "@/types/chat"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

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
          <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-2 break-words",
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <div className="text-xs opacity-50 mt-1">{format(new Date(message.createdAt), "HH:mm")}</div>
            </div>
          </div>
        ))
      )}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-muted max-w-[80%] rounded-lg px-4 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

