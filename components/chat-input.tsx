"use client"

import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { ModelSelector } from "@/components/model-selector"
import { useChat } from "@/context/chat-context"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp } from "lucide-react"

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  isSubmitting: boolean
  setIsSubmitting: (value: boolean) => void
}

export function ChatInput({ input, setInput, isSubmitting, setIsSubmitting }: ChatInputProps) {
  const { sendMessage, currentChat } = useChat()
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [originalInput, setOriginalInput] = useState<string | null>(null)

  const userMessages = currentChat?.messages.filter(m => m.role === 'user').reverse() ?? [];

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isSubmitting) return

    const message = input.trim()
    setInput("") 
    setIsSubmitting(true)
    setHistoryIndex(-1) // Reset history index on submit
    setOriginalInput(null) // Reset original input on submit

    try {
      await sendMessage(message)
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.altKey) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (userMessages.length === 0) return;

        if (historyIndex === -1) {
          setOriginalInput(input); // Store current input when starting history nav
        }

        const nextIndex = Math.min(historyIndex + 1, userMessages.length - 1);
        if (nextIndex >= 0) {
          setInput(userMessages[nextIndex].content);
          setHistoryIndex(nextIndex);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > -1) {
          const nextIndex = historyIndex - 1;
          if (nextIndex >= 0) {
            setInput(userMessages[nextIndex].content);
            setHistoryIndex(nextIndex);
          } else {
            // Reached the beginning, restore original input or clear
            setInput(originalInput ?? ''); 
            setHistoryIndex(-1);
            setOriginalInput(null);
          }
        }
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  return (
    <div className="fixed bottom-0 right-0 z-10 w-full md:w-[calc(100%-256px)] bg-gradient-to-t from-background to-transparent py-4">
      <div className="w-full max-w-5xl mx-auto px-4">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex flex-col bg-background border border-border rounded-xl shadow-lg p-2 relative">
            <div className="flex flex-col space-y-2">
              <Textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here... (Shift+Enter for new line)"
                className="w-full min-h-[40px] max-h-[200px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent resize-none text-lg"
                disabled={isSubmitting}
              />
              <div className="flex items-center justify-between">
                <div className="max-w-[25%]">
                  <ModelSelector />
                </div>
                <Button 
                  type="submit" 
                  size="icon"
                  disabled={isSubmitting || !input.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl mr-2 mb-2"
                >
                  <ArrowUp/>
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
} 