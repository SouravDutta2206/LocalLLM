"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronUp, Pin, PinOff } from "lucide-react"
import { useChat } from "@/context/chat-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from 'next/image'
import { Input } from "@/components/ui/input"

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

interface OpenRouterModel {
  id: string;
  name: string;
}

interface OpenRouterResponse {
  data: Array<{
    id: string;
    name: string;
  }>;
}

interface GroupedModels {
  [provider: string]: Model[]
}

// Define interface for logo data
interface LogoProvider {
  name: string;
  path: string;
}

// Helper function to normalize provider names for display
const formatProviderName = (provider: string) => {
  if (provider === "Google Gemini") return "Gemini"
  if (provider === "HuggingFace") return "HuggingFace"
  if (provider === "Ollama") return "Ollama"
  if (provider === "OpenRouter") return "OpenRouter"
  // Add more cases if needed
  return provider // Default fallback
};

export function ModelSelector() {
  const { settings, updateChatSettings } = useChat()
  const [isOpen, setIsOpen] = useState(false)
  const [groupedModels, setGroupedModels] = useState<GroupedModels>({})
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [logoMap, setLogoMap] = useState<LogoProvider[]>([]) // State for logo data
  const [searchTerm, setSearchTerm] = useState("") // State for search term
  const [pinnedModels, setPinnedModels] = useState<string[]>([]) // State for pinned models

  useEffect(() => {
    setMounted(true)
    // Load pinned models from localStorage
    const storedPinnedModels = localStorage.getItem("pinnedModels")
    if (storedPinnedModels) {
      try {
        const parsedModels = JSON.parse(storedPinnedModels);
        if (Array.isArray(parsedModels)) {
          setPinnedModels(parsedModels);
        } else {
          console.warn("Invalid pinned models format in localStorage");
          localStorage.removeItem("pinnedModels"); // Clear invalid data
        }
      } catch (error) {
        console.error("Error parsing pinned models from localStorage:", error);
        localStorage.removeItem("pinnedModels"); // Clear corrupted data
      }
    }

    // Fetch logo data
    const fetchLogos = async () => {
      try {
        const response = await fetch('/data/logos.json');
        if (!response.ok) {
          console.warn('Failed to fetch logos.json. Status:', response.status);
          return;
        }
        const data = await response.json();
        setLogoMap(data.providers || []); // Assuming the structure is { providers: [...] }
      } catch (error) {
        console.error('Error fetching logos:', error);
      }
    };
    fetchLogos();
  }, [])

  // Function to find logo path based on name
  const findLogoPath = (name: string): string | null => {
    const lowerCaseName = name.toLowerCase();
    let foundPath: string | null = null;

    for (const logoProvider of logoMap) {
      if (lowerCaseName.includes(logoProvider.name.toLowerCase())) {
        foundPath = logoProvider.path;
        break; // Found a match, stop searching
      }
    }

    if (foundPath) {
      // Ensure path starts with '/' and remove 'public/'
      let relativePath = foundPath.startsWith('public/') ? foundPath.substring('public/'.length) : foundPath;
      if (!relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
      }
      return relativePath;
    }

    return null; // Return null if no logo found
  };

  // Effect to save pinned models to localStorage whenever they change
  useEffect(() => {
    if (mounted) { // Only save after initial mount and load
      localStorage.setItem("pinnedModels", JSON.stringify(pinnedModels));
    }
  }, [pinnedModels, mounted]);

  const fetchOllamaModels = async (): Promise<Model[]> => {
    try {
      const response = await fetch('/api/ollama/models');
      if (!response.ok) {
        console.warn('Failed to fetch Ollama models, proceeding without them.')
        return []
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

  const fetchOpenRouterModels = async (): Promise<Model[]> => {
    try {
      const response = await fetch('/data/openrouter_models.json');
      if (!response.ok) {
        console.warn('Failed to fetch OpenRouter models, proceeding without them.')
        return []
      }
      const data: OpenRouterResponse = await response.json();
      return data.data.map(model => ({
        name: model.id,
        provider: 'OpenRouter'
      }));
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      return [];
    }
  };

  useEffect(() => {
    const loadAllModels = async () => {
      const settingsModels: Model[] = [];
      settings.providers.forEach((provider) => {
        if (provider.Models && provider.Provider !== "OpenRouter") {  // Skip OpenRouter models from settings
          const modelNames = provider.Models.split(",").map((m) => m.trim()).filter(name => name);
          modelNames.forEach((name) => {
            let providerName = provider.Provider
            // Normalize provider names here if needed, or use formatProviderName
            if (providerName === "Google Gemini") providerName = "gemini"
            settingsModels.push({ name, provider: providerName });
          });
        }
      });

      const [ollamaModels, openRouterModels] = await Promise.all([
        fetchOllamaModels(),
        fetchOpenRouterModels()
      ]);
      
      const allModels = [...settingsModels, ...ollamaModels, ...openRouterModels];
      
      const grouped: GroupedModels = {};
      allModels.forEach(model => {
        const providerKey = model.provider || "Unknown"; // Group models without provider under 'Unknown'
        if (!grouped[providerKey]) {
          grouped[providerKey] = [];
        }
        grouped[providerKey].push(model);
      });

      setGroupedModels(grouped);

      // Set the initial active tab to the first provider with models
      const providersWithModels = Object.keys(grouped).filter(p => grouped[p].length > 0);
      if (providersWithModels.length > 0) {
        // Find the provider of the currently selected model, if any
        const currentProvider = allModels.find(m => m.name === settings.activeModel)?.provider;
        if (currentProvider && grouped[currentProvider]) {
           setActiveTab(currentProvider);
        } else {
           // Fallback to the first provider if the current model's provider isn't found or has no models
           setActiveTab(providersWithModels[0]);
        }
      }

      if (settings.activeModel) {
        const modelExists = allModels.some((model) => model.name === settings.activeModel)
        if (modelExists) {
          setSelectedModel(settings.activeModel)
        } else {
          setSelectedModel("")
          // If selected model doesn't exist, maybe clear activeTab or set to first provider?
          if (providersWithModels.length > 0) {
            setActiveTab(providersWithModels[0]);
          }
        }
      }
    };

    loadAllModels();
  }, [settings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleSelectModel = (model: Model) => {
    setSelectedModel(model.name);
    const updatedSettings = {
      ...settings,
      activeModel: model.name,
      activeProvider: model.provider
    };
    updateChatSettings(updatedSettings);
    setIsOpen(false);
  };

  // Function to toggle pin status of a model
  const handleTogglePin = (modelName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the model when clicking the pin
    setPinnedModels(prevPinned => {
      if (prevPinned.includes(modelName)) {
        // Unpin: Remove the model name
        return prevPinned.filter(name => name !== modelName);
      } else {
        // Pin: Add the model name
        return [...prevPinned, modelName];
      }
    });
  };

  if (!mounted) {
    return null // Or a placeholder button
  }

  const providers = Object.keys(groupedModels).filter(p => groupedModels[p].length > 0); // Only show tabs for providers with models

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Button to show selected model and toggle dropdown */}
      <Button
        variant="ghost"
        className="flex w-full justify-between px-2 py-1.5 ml-2 mb-1 text-sm text-gray-200 bg-transparent hover:bg-muted/50 rounded-md transition-colors"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
      >
        <span className="truncate ml-2">{selectedModel || "Choose Model"}</span>
        <ChevronUp className={cn("h-4 w-4 transition-transform mr-2 flex-shrink-0", !isOpen && "rotate-180")} />
      </Button>

      {/* Dropdown with Tabs */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 right-0 ml-2 mb-1 w-[600px] h-[400px] bg-muted text-muted-foreground rounded-xl shadow-lg z-[60] border border-gray-700 flex overflow-hidden"
        >
          {/* Left Side: Container for Search + List */}          
          <div className="flex-1 flex flex-col bg-muted max-w-[80%]"> {/* flex-1 takes width, flex-col stacks items */}
            {/* Search Bar (Stays at top) */}            
            <div className="p-2 border-b border-gray-700 flex-shrink-0">
              <Input 
                placeholder="Search models..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#35373c] border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-100"
              />
            </div>

            {/* Scrollable Model List Area */}            
            <div className="flex-1 overflow-y-auto"> {/* flex-1 takes height, scrollable */}              
              {activeTab && groupedModels[activeTab] ? (() => {
                const filteredModels = groupedModels[activeTab].filter(model =>
                  model.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                const pinned = filteredModels
                  .filter(model => pinnedModels.includes(model.name))
                  .sort((a, b) => a.name.localeCompare(b.name)); // Sort pinned alphabetically

                const regular = filteredModels.filter(model => !pinnedModels.includes(model.name));

                const renderModelItem = (model: Model, index: number) => {
                  let logoPath = findLogoPath(model.name);
                  if (!logoPath) {
                    const lowerProvider = model.provider.toLowerCase();
                    if (lowerProvider.includes('google') || lowerProvider.includes('gemini')) {
                      logoPath = '/google.svg';
                    } else if (lowerProvider.includes('ollama')) {
                      logoPath = '/ollama.svg';
                    } else if (lowerProvider.includes('huggingface')) {
                      logoPath = '/huggingface.svg';
                    } else if (lowerProvider.includes('openrouter')) {
                      logoPath = '/openrouter.svg';
                    } else {
                      logoPath = null;
                    }
                  }
                  const isPinned = pinnedModels.includes(model.name);

                  return (
                    <div
                      key={`${model.provider}-${model.name}-${index}`} // More specific key
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex items-center justify-between w-full px-4 py-3 text-left text-sm cursor-pointer group", // Added group for hover effect on button
                        selectedModel === model.name ? "bg-[#3f4146]" : "hover:bg-[#35373c]"
                      )}
                      onClick={() => handleSelectModel(model)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectModel(model);
                        }
                      }}
                    >
                      <div className="flex items-center overflow-hidden mr-2"> {/* Container for logo and name */}
                        {logoPath && (
                          <Image
                            src={logoPath}
                            alt={`${model.name} logo`}
                            width={16}
                            height={16}
                            className="mr-2 flex-shrink-0"
                          />
                        )}
                        <div className="font-medium text-gray-100 truncate">{model.name}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 p-1 text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100", // Show on hover/focus
                          isPinned && "opacity-100 text-blue-400 hover:text-blue-300", // Always show if pinned, different color
                           !isPinned && "hover:text-gray-200" // Hover color when not pinned
                        )}
                        onClick={(e) => handleTogglePin(model.name, e)}
                        aria-label={isPinned ? "Unpin model" : "Pin model"}
                      >
                        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                    </div>
                  );
                };

                return (
                  <>
                    {pinned.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Pinned</div>
                        {pinned.map(renderModelItem)}
                        {regular.length > 0 && <div className="h-px bg-gray-700 my-2 mx-4"></div>} {/* Separator */}
                      </>
                    )}
                    {regular.length > 0 && (
                       <>
                        {pinned.length > 0 && <div className="px-4 pt-1 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Models</div>}
                        {regular.map(renderModelItem)}
                       </>
                    )}
                    {filteredModels.length === 0 && searchTerm && (
                        <div className="p-4 text-center text-gray-400">No models match your search.</div>
                    )}
                  </>
                );

              })() : (
                <div className="p-4 text-center text-gray-400">Select a provider tab.</div>
              )}
            </div> {/* End Scrollable Model List Area */}            
          </div> {/* End Left Side */}          

          {/* Right Side: Provider Tabs */}          
          <div className="w-35 flex-shrink-0 bg-[#1e1f22] border-l border-gray-700 overflow-y-auto">
            {providers.map(provider => {
              // Hardcode provider logo paths
              let providerLogoPath: string | null = null;
              const lowerProvider = provider.toLowerCase();
              if (lowerProvider.includes('google') || lowerProvider.includes('gemini')) {
                providerLogoPath = '/google.svg'; // Assuming gemini.svg exists in public/
              } else if (lowerProvider.includes('ollama')) {
                providerLogoPath = '/ollama.svg'; // Assuming ollama.svg exists in public/
              } else if (lowerProvider.includes('huggingface')) {
                providerLogoPath = '/huggingface.svg'; // Assuming huggingface.svg exists in public/
              } else if (lowerProvider.includes('openrouter')) {
                providerLogoPath = '/openrouter.svg'; // Assuming openrouter.svg exists in public/
              }
              // Add more providers here if needed

              return (
                <button
                  key={provider}
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm font-medium flex items-center",
                    activeTab === provider
                      ? "bg-[#35373c] text-white"
                      : "text-gray-400 hover:bg-[#2b2d31] hover:text-gray-200"
                  )}
                  onClick={() => {
                    setActiveTab(provider)
                    setSearchTerm("") // Reset search term on tab change
                  }}
                >
                  {/* Render logo if path exists */}
                  {providerLogoPath && (
                    <Image 
                      src={providerLogoPath} 
                      alt={`${provider} logo`} 
                      width={16} 
                      height={16} 
                      className="mr-2 flex-shrink-0"
                    />
                  )}
                  {formatProviderName(provider)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  )
}

