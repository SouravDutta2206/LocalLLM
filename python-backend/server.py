import sys
sys.dont_write_bytecode = True

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import asyncio
import json
import ollama
from openai import OpenAI
from huggingface_hub import InferenceClient
import google.generativeai as genai
import re
from prompts import gemini_prompt_format

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

async def format_chunk(content: str, model: str) -> str:
    """Format a chunk for SSE streaming"""
    data = {
        "content": content,
        "model": model
    }
    return f"data: {json.dumps(data)}\n\n"

# def format_conversation_with_prompt(conversation: List[Message]) -> List[Message]:
#     """Format the last user message with the base prompt and return the updated conversation"""
#     if not conversation:
#         return conversation
    
#     history = conversation[:-1]
#     last_message = conversation[-1]
    
#     if last_message.role != "user":
#         return conversation
    
#     formatted_prompt = base_prompt(last_message.content)
#     formatted_message = Message(
#         role="user",
#         content=formatted_prompt[0]["content"]
#     )
    
#     return history + [formatted_message]

# def base_prompt(query_text: str):

#     prompt = [
#         {
#             "role" : "user",
#             "content" : re.sub(r"[^\S\n]+", " ", f'''You are an AI assistant designed to provide detailed and informative answers to user questions. Your goal is to analyze the question, draw upon your vast knowledge base, and formulate a comprehensive, well-structured response.
#                         User Question: {query_text}
#                         Important Instruction to follow strictly-
                        
#                         To answer the question:
#                         1. Thoroughly analyze the question, identifying key information and its underlying intent.
#                         2. Organize your thoughts and plan your response to ensure a logical flow of information and a clear articulation of your understanding.
#                         3. Formulate a detailed answer that directly addresses the question, drawing upon your extensive knowledge and reasoning capabilities.
#                         4. Ensure your answer is comprehensive, covering all relevant aspects and perspectives.
#                         5. Acknowledge any limitations in your knowledge or understanding, and suggest avenues for further exploration if appropriate.
                        
#                         Format your response as follows:
#                         1. Use clear, concise, and accurate language.
#                         2. Organize your answer into paragraphs for readability and a clear progression of ideas.
#                         3. Use bullet points or numbered lists where appropriate to break down complex information or present a series of related points.
#                         4. If relevant, include any headings or subheadings to structure your response.
#                         5. Ensure proper grammar, punctuation, and spelling throughout your answer.
                        
#                         Important: Base your entire response solely on the information provided in the context. Do not include any external knowledge or assumptions not present in the given text.''')
#         }
#     ]

#     return prompt

def filter_conversation(conversation: List[Message]) -> List[Message]:
    """Filter out empty or invalid messages from the conversation."""
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

@app.post("/api/chat")
async def chat(request: ChatRequest):

    request.conversation = filter_conversation(request.conversation)

    # Debug print
    # print("\n=== Debug: ChatRequest ===")
    # print(f"Model: {request.model}")
    # print("\nConversation:")
    # for msg in request.conversation:
    #     print(f"Role: {msg.role}, Content: {msg.content}")
    # print("=======================\n")

    provider = request.model.provider.lower()
    model_name = request.model.name

    # Filter out empty messages before any processing

    # formatted_conversation = format_conversation_with_prompt(request.conversation)
    # request.conversation = formatted_conversation

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