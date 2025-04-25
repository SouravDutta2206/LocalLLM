import sys
sys.dont_write_bytecode = True

from fastapi.responses import StreamingResponse
import asyncio
import json
import ollama
from groq import Groq
from openai import OpenAI
from huggingface_hub import InferenceClient
from google import genai
from google.genai import types
from utils.prompts import gemini_prompt_format
from utils.schemas import ChatRequest, RequestState

async def format_chunk(content: str, model: str) -> str:
    """Format a chunk for SSE streaming"""
    data = {
        "content": content,
        "model": model
    }
    return f"data: {json.dumps(data)}\n\n"

async def chat_ollama(request: ChatRequest, state: RequestState):
    async def generate():
        try:
            messages = [{"role": msg.role, "content": msg.content} for msg in request.conversation]
            stream = ollama.chat(
                model=request.model.name,
                messages=messages,
                stream=True,
            )
            
            for chunk in stream:
                if state.is_disconnected():
                    # Client disconnected, stop streaming
                    break
                    
                if chunk and chunk.get('message', {}).get('content'):
                    content = chunk['message']['content']
                    yield await format_chunk(content, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
                    
        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

async def chat_huggingface(request: ChatRequest, state: RequestState):
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
                if state.is_disconnected():
                    # Client disconnected, stop streaming
                    break
                    
                if chunk and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield await format_chunk(content, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
                    
        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

async def chat_openrouter(request: ChatRequest, state: RequestState):
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
                if state.is_disconnected():
                    # Client disconnected, stop streaming
                    break
                    
                if chunk and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield await format_chunk(content, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
                    
        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

async def chat_groq(request: ChatRequest, state: RequestState):
    async def generate():
        try:
            client = Groq(api_key=request.model.key)
            
            messages = [{"role": msg.role, "content": msg.content} for msg in request.conversation]
            stream = client.chat.completions.create(
                model=request.model.name,
                messages=messages,
                stream=True,
            )
            
            for chunk in stream:
                if state.is_disconnected():
                    # Client disconnected, stop streaming
                    break
                    
                if chunk and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield await format_chunk(content, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
                    
        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

async def chat_gemini(request: ChatRequest, state: RequestState):
    async def generate():
        try:
            
            gen_config = types.GenerateContentConfig(
                response_mime_type="text/plain",
            )

            client = genai.Client(api_key=request.model.key)

            gemini_prompt = gemini_prompt_format(request.conversation)

            chunks = client.models.generate_content_stream(model=request.model.name,contents=gemini_prompt,config=gen_config)


            for chunk in chunks:

                if state.is_disconnected():
                    # Client disconnected, stop streaming
                    break
                    
                if chunk.text:
                    yield await format_chunk(chunk.text, request.model.name)
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")