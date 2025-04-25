export interface Model {
    name: string
    provider: string
}
  
export interface OllamaModel {
name: string
modified_at: string
size: number
}

export interface OllamaListResponse {
models: OllamaModel[]
}

export interface ModelData {
id: string;
}

export interface ModelResponse {
data: ModelData[]
}

export interface GroupedModels {
[provider: string]: Model[]
}

export interface LogoProvider {
name: string;
path: string;
}