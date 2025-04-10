"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Copy, Check } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypePrismPlus from "rehype-prism-plus"
import "prismjs/themes/prism-tomorrow.css"
import "@/app/globals.css"

interface MessageContentProps {
  content: string
  isUser: boolean
}

export function MessageContent({ content, isUser }: MessageContentProps) {
  if (isUser) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>
  }

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypePrismPlus, { ignoreMissing: true, showLineNumbers: true }]]}
        components={{
          pre: ({ node, ...props }) => {
            const [copied, setCopied] = useState(false)
            const preRef = useRef<HTMLPreElement>(null)
            const [language, setLanguage] = useState("")
            
            useEffect(() => {
              if (preRef.current) {
                const codeElement = preRef.current.querySelector('code')
                const lang = codeElement?.className?.match(/language-(\w+)/)?.[1]
                if (lang) {
                  setLanguage(lang)
                }
              }
            }, [])
            
            const handleCopy = async () => {
              if (preRef.current) {
                const code = preRef.current.textContent
                await navigator.clipboard.writeText(code || '')
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }
            }
            
            return (
              <div className="relative group rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between bg-zinc-800 px-4 py-2">
                  <div className="text-sm text-zinc-400">
                    {language}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <pre ref={preRef} {...props} className="!mt-0 !rounded-t-none bg-zinc-950 p-4 overflow-x-auto" />
              </div>
            )
          },
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match
            if (isInline) {
              return (
                <code {...props} className="bg-zinc-800 rounded px-1.5 py-0.5">
                  {children}
                </code>
              )
            }
            return (
              <code {...props} className={cn(className, "bg-transparent")}>
                {children}
              </code>
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
} 