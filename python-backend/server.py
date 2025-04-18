import sys
sys.dont_write_bytecode = True

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import asyncio
import os
import json
import ollama
import requests
from pathlib import Path
from openai import OpenAI
from huggingface_hub import InferenceClient
import google.generativeai as genai
import re
from utils.prompts import base_prompt
from utils.gemini_list import get_gemini_models_list


app = FastAPI(
    title="LLM Chat API",
    description="API for interacting with various LLM models with streaming support",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class ModelInfo(BaseModel):
    name: str
    provider: str
    key: str

class ChatRequest(BaseModel):
    conversation: List[Message]
    model: ModelInfo

class ChatResponse(BaseModel):
    response: str
    model: str

class GeminiModelInfo(BaseModel):
    id: str

class GeminiModelsRequest(BaseModel):
    api_key: str


class GeminiModelsResponse(BaseModel):
    data: List[GeminiModelInfo]


async def format_chunk(content: str, model: str) -> str:
    """Format a chunk for SSE streaming"""
    data = {
        "content": content,
        "model": model
    }
    return f"data: {json.dumps(data)}\n\n"

def format_conversation_with_prompt(conversation: List[Message]) -> List[Message]:
    # Format the last user message with the base prompt and return the updated conversation
    if not conversation:
        return conversation
    
    history = conversation[:-1]
    last_message = conversation[-1]
    
    if last_message.role != "user":
        return conversation
    
    formatted_prompt = base_prompt(last_message.content)
    formatted_message = Message(
        role="user",
        content=formatted_prompt[0]["content"]
    )
    
    return history + [formatted_message]


def filter_conversation(conversation: List[Message]) -> List[Message]:
    # Filter out empty or invalid messages from the conversation
    def is_valid_content(content: str) -> bool:
        if content is None:
            return False
        if content.lower() == "undefined":
            return False
        if not content.strip():  # Handles "", " ", and whitespace-only strings
            return False
        return True

    return [
        msg for msg in conversation 
        if is_valid_content(msg.content)
    ]

@app.post("/api/gemini/models")
async def get_gemini_models(request: GeminiModelsRequest):
    try:

        # Get available models
        models = get_gemini_models_list(Gemini_KEY=request.api_key)
        
        response = GeminiModelsResponse(
            data=[GeminiModelInfo(id=model) for model in models]
        )
        
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest):

    # Filter out empty messages before any processing
    request.conversation = filter_conversation(request.conversation)

    provider = request.model.provider.lower()
    model_name = request.model.name

    # print("\n=== Debug: ChatRequest ===")
    print(f"Provider: {provider}")
    print(f"Model Name: {model_name}")
    
    formatted_conversation = format_conversation_with_prompt(request.conversation)
    request.conversation = formatted_conversation
    # print("\nConversation:")
    # for msg in request.conversation:
    #     print(f"Role: {msg.role}, Content: {msg.content}")

    if provider == "ollama":
        return await chat_ollama(request)
    elif provider == "huggingface":
        return await chat_huggingface(request)
    elif provider == "openrouter":
        return await chat_openrouter(request)
    elif provider == "gemini":
        return await chat_gemini(request)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

async def chat_ollama(request: ChatRequest):
    async def generate():
        try:
            messages = [{"role": msg.role, "content": msg.content} for msg in request.conversation]
            stream = ollama.chat(
                model=request.model.name,
                messages=messages,
                stream=True,
            )
            
            for chunk in stream:
                if chunk and chunk.get('message', {}).get('content'):
                    content = chunk['message']['content']
                    yield await format_chunk(content, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
                    
        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

async def chat_huggingface(request: ChatRequest):
    async def generate():
        try:
            client = InferenceClient(request.model.name, token=request.model.key)
            messages = [{"role": msg.role, "content": msg.content} for msg in request.conversation]
            
            stream = client.chat.completions.create(
                model=request.model.name,
                messages=messages,
                stream=True,
            )
            
            for chunk in stream:
                if chunk and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield await format_chunk(content, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
                    
        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

async def chat_openrouter(request: ChatRequest):
    async def generate():
        try:
            client = OpenAI(
                api_key=request.model.key,
                base_url='https://openrouter.ai/api/v1'
            )
            
            messages = [{"role": msg.role, "content": msg.content} for msg in request.conversation]
            stream = client.chat.completions.create(
                model=request.model.name,
                messages=messages,
                stream=True,
            )
            
            for chunk in stream:
                if chunk and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield await format_chunk(content, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
                    
        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

async def chat_gemini(request: ChatRequest):
    async def generate():
        try:
            # Configure Gemini
            genai.configure(api_key=request.model.key)
            model = genai.GenerativeModel(request.model.name)
            
            # Convert messages to Gemini format
            messages = []
            for msg in request.conversation:
                if msg.role in ["user", "assistant"]:
                    messages.append({
                        "role": "user" if msg.role == "user" else "model",
                        "parts": [msg.content]
                    })
            
            # Create chat with all messages
            chat = model.start_chat()
            
            # Send all messages in sequence to build up the conversation
            for i, msg in enumerate(messages[:-1]):
                chat.send_message(msg["parts"][0], stream=False)
            
            # Stream the response for the last message
            response = chat.send_message(messages[-1]["parts"][0], stream=True)
            
            for chunk in response:
                if chunk.text:
                    yield await format_chunk(chunk.text, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming

        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

if __name__ == "__main__":

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 