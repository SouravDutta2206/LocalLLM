"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface EditMessageInputProps {
  initialContent: string
  messageId: string
  onSave: (messageId: string, newContent: string) => void
  onCancel: () => void
}

export function EditMessageInput({
  initialContent,
  messageId,
  onSave,
  onCancel,
}: EditMessageInputProps) {
  const [editText, setEditText] = useState(initialContent)

  // Ensure textarea focuses when the component mounts (edit mode starts)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    textareaRef.current?.focus()
    // Select all text on focus for easier editing
    textareaRef.current?.select()
    // Initial resize on mount
    handleInput();
  }, [])

  const handleSave = () => {
    const trimmedContent = editText.trim()
    if (trimmedContent && trimmedContent !== initialContent) {
      onSave(messageId, trimmedContent)
    }
    // Parent handles closing via state update after save
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, cancel on Escape
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault() // Prevent newline
      handleSave()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  // Function to handle manual resize
  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height
      // Set height based on scroll height, considering potential max height later
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  return (
    <div className="space-y-2 w-full">
      <Textarea
        ref={textareaRef}
        value={editText}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditText(e.target.value)}
        onInput={handleInput} // Call resize function on input
        onKeyDown={handleKeyDown}
        className="w-full resize-none overflow-y-auto bg-muted border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-2 rounded-xl max-h-40" // Added overflow-hidden, max-h-40 (10rem)
        rows={2} // Start with initial rows (adjust as needed)
      />
      <div className="flex justify-end space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={!editText.trim() || editText.trim() === initialContent}
        >
          Save & Submit
        </Button>
      </div>
    </div>
  )
} 