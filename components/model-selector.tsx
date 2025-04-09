"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronUp } from "lucide-react"
import { useChat } from "@/context/chat-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Model {
  name: string
  provider: string
}

interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

interface OllamaListResponse {
  models: OllamaModel[]
}

export function ModelSelector() {
  const { settings, updateChatSettings } = useChat()
  const [isOpen, setIsOpen] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [maxWidth, setMaxWidth] = useState<number>(0)
  const [mounted, setMounted] = useState(false)

  // Add mounted state to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch Ollama models
  const fetchOllamaModels = async () => {
    try {
      const response = await fetch('/api/ollama/models');
      if (!response.ok) {
        throw new Error('Failed to fetch Ollama models');
      }
      const data: OllamaListResponse = await response.json();
      return data.models.map(model => ({
        name: model.name,
        provider: 'Ollama'
      }));
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      return [];
    }
  };

  // Extract models from settings and calculate max width
  useEffect(() => {
    const loadAllModels = async () => {
      const settingsModels: Model[] = [];
      
      // Load models from settings
      settings.providers.forEach((provider) => {
        if (provider.Models) {
          const modelNames = provider.Models.split(",").map((m) => m.trim())
          modelNames.forEach((name) => {
            if (name) {
              let providerName = provider.Provider
              if (providerName === "HuggingFace") providerName = "HuggingFace"
              else if (providerName === "OpenRouter") providerName = "OpenRouter"
              else if (providerName === "Gemini") providerName = "Google Gemini"

              settingsModels.push({
                name,
                provider: providerName,
              })
            }
          })
        }
      })

      // Load Ollama models
      const ollamaModels = await fetchOllamaModels();
      const allModels = [...settingsModels, ...ollamaModels];

      setModels(allModels);

      // If there's an activeModel in settings and it's in our model list, select it
      if (settings.activeModel) {
        const modelExists = allModels.some((model) => model.name === settings.activeModel)
        if (modelExists) {
          setSelectedModel(settings.activeModel)
        } else {
          setSelectedModel("")
        }
      }

      // Calculate max width for dropdown
      if (allModels.length > 0) {
        // Create a temporary span to measure text width
        const tempSpan = document.createElement("span")
        tempSpan.style.visibility = "hidden"
        tempSpan.style.position = "absolute"
        tempSpan.style.whiteSpace = "nowrap"
        tempSpan.style.font = "16px sans-serif" // Approximate font size
        document.body.appendChild(tempSpan)

        // Find the longest model name + provider
        let maxTextWidth = 0
        allModels.forEach((model) => {
          tempSpan.textContent = `${model.name} - ${model.provider}`
          const width = tempSpan.getBoundingClientRect().width
          if (width > maxTextWidth) {
            maxTextWidth = width
          }
        })

        // Add padding
        maxTextWidth += 100 // Add some padding
        setMaxWidth(maxTextWidth)

        // Clean up
        document.body.removeChild(tempSpan)
      }
    };

    loadAllModels();
  }, [settings]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelectModel = (model: Model) => {
    setSelectedModel(model.name)
    updateChatSettings({
      ...settings,
      activeModel: model.name,
    })
    setIsOpen(false)
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        className="flex justify-between px-3 ml-3 py-1.5 text-sm text-gray-200 bg-transparent hover:bg-muted/50 rounded-md transition-colors"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
      >
        <span className="truncate">{selectedModel || "Choose Model"}</span>
        <ChevronUp className={cn("h-4 w-4 transition-transform", !isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div
          className="absolute bottom-full mb-1 bg-muted text-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50 border border-gray-600"
          style={{
            minWidth: "100%",
            width: maxWidth > 0 ? `${maxWidth}px` : "auto",
          }}
        >
          {models.length > 0 ? (
            <div className="py-1">
              {models.map((model, index) => (
                <div
                  key={`${model.name}-${model.provider}-${index}`}
                  role="button"
                  tabIndex={0}
                  className="flex w-full px-3 py-2 text-left hover:bg-gray-800 focus:outline-none focus:bg-gray-800 whitespace-nowrap text-sm cursor-pointer"
                  onClick={() => handleSelectModel(model)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectModel(model);
                    }
                  }}
                >
                  <span>
                    {model.name} - {model.provider}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-gray-400 text-sm">No models available</div>
          )}
        </div>
      )}
    </div>
  )
}

