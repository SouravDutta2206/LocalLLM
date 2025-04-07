"use client"

import { useState, useEffect, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sidebar } from "@/components/sidebar"
import { ChatHeader } from "@/components/chat-header"
import { MessageList } from "@/components/message-list"
import { WelcomeScreen } from "@/components/welcome-screen"
import { ModelSelector } from "@/components/model-selector"
import { useMobile } from "@/hooks/use-mobile"
import { useChat } from "@/context/chat-context"
import { Textarea } from "@/components/ui/textarea"

export default function ChatInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isMobile = useMobile()
  const { currentChat, sendMessage, isLoading } = useChat()

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSubmitting) return

    setIsSubmitting(true)
    setInput("")

    try {
      await sendMessage(input.trim())
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Return a simple div with the same structure while not mounted
  if (!mounted) {
    return <div className="flex h-screen bg-background" />
  }

  return (
    <>
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:z-0`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 h-full overflow-y-auto">
        <ChatHeader toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

        <div className="flex-1 flex flex-col items-center relative">
          <div className="w-full max-w-3xl h-full flex flex-col">
            {!currentChat ? (
              <WelcomeScreen />
            ) : (
              <MessageList messages={currentChat?.messages || []} isLoading={isLoading || isSubmitting} />
            )}
          </div>

          <div className="w-full bg-gradient-to-t from-background to-transparent py-4 fixed bottom-0">
            <div className="w-full max-w-3xl mx-auto px-4">
              <form onSubmit={handleSubmit} className="flex flex-col">
                <div className="flex flex-col bg-background border border-border rounded-lg shadow-lg p-2 relative">
                  <div className="flex flex-col space-y-2">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message here... (Shift+Enter for new line)"
                      className="w-full min-h-[40px] max-h-[200px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent resize-none"
                      disabled={isSubmitting}
                    />
                    <div className="flex justify-between items-center">
                      <div className="w-[25%]">
                        <ModelSelector />
                      </div>
                      <Button 
                        type="submit" 
                        disabled={isSubmitting || !input.trim()}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

