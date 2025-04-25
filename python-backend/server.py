import asyncio
import os
process_env = os.environ.copy()
process_env["PYTHONIOENCODING"] = "utf-8"
import subprocess
import sys
sys.dont_write_bytecode = True

#server
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json
from utils.prompts import base_prompt, prompt_with_context
from utils.model_list import get_gemini_models_list, get_groq_models_list
from contextlib import asynccontextmanager
from utils.schemas import ModelResponse, ModelRequest, ModelID, ChatRequest, Message, RequestState
from utils.query_func import chat_ollama, chat_huggingface, chat_openrouter, chat_groq, chat_gemini


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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize request state storage on startup
    app.state.active_requests = set()
    print("Initialized active_requests set")
    yield
    # Cleanup on shutdown
    app.state.active_requests.clear()
    print("Cleared active_requests set")

app.lifespan = lifespan

async def format_chunk(content: str, model: str) -> str:
    """Format a chunk for SSE streaming"""
    data = {
        "content": content,
        "model": model
    }
    return f"data: {json.dumps(data)}\n\n"

# def format_conversation_with_prompt(conversation: List[Message], web_search_bool: bool = False) -> List[Message]:
#     # Format the last user message with the base prompt and return the updated conversation
#     if not conversation:
#         return conversation
    
#     history = conversation[:-1]
#     last_message = conversation[-1]
    
#     if last_message.role != "user":
#         return conversation
    
#     if web_search_bool:
#         web_search_results , sources = asyncio.run(web_search(last_message.content))
#     else:
#         web_search_results = ""
#         web_sources = []

#     sources = []
#     system_prompt = "" + web_search_results
#     sources = sources + web_sources

#     if system_prompt:
#         formatted_prompt = prompt_with_context(context=web_search_results, query=last_message.content)
#     else:
#         formatted_prompt = base_prompt(last_message.content)

#     formatted_message = Message(
#         role="user",
#         content=formatted_prompt[0]["content"]
#     )
    
#     return history + [formatted_message] , sources

async def run_web_search_and_get_context_async(prompt: str) -> str | None:
    
    script_name = "C4AI_web_search.py" # Make sure this filename is correct
    script_path = os.path.join(os.getcwd(), "python-backend", "utils", script_name)

    if not os.path.exists(script_path):
        print(f"Error: The script '{script_path}' was not found.", file=sys.stderr)
        return None

    # Command arguments for asyncio.create_subprocess_exec
    # The program itself (sys.executable) is the first argument here
    command_args = [script_path, prompt]

    print(f"Running command async: {sys.executable} {' '.join(command_args)}", file=sys.stderr)

    process = None # Initialize process variable
    try:
        # Start the subprocess asynchronously
        process = await asyncio.create_subprocess_exec(
            sys.executable,             # Program to execute
            *command_args,              # Arguments to the program
            stdout=asyncio.subprocess.PIPE, # Capture stdout
            stderr=asyncio.subprocess.PIPE, # Capture stderr
            env=process_env             # Pass the modified environment
        )

        # Wait for the subprocess to complete and read stdout/stderr
        # Set a timeout for the communication
        timeout_seconds = 300
        try:
            stdout_data, stderr_data = await asyncio.wait_for(
                process.communicate(), timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            print(f"Error: Subprocess timed out after {timeout_seconds} seconds.", file=sys.stderr)
            # Attempt to kill the process if it timed out
            if process.returncode is None: # Check if it's still running
                try:
                    process.kill()
                    await process.wait() # Ensure it's terminated
                    print("Subprocess killed due to timeout.", file=sys.stderr)
                except ProcessLookupError:
                    print("Subprocess already finished before kill attempt.", file=sys.stderr) # Process finished between timeout and kill
                except Exception as kill_err:
                    print(f"Error trying to kill timed-out process: {kill_err}", file=sys.stderr)
            return None # Return None on timeout

        # Decode the output (assuming utf-8, handle potential errors)
        stdout_str = stdout_data.decode('utf-8', errors='ignore').strip()
        stderr_str = stderr_data.decode('utf-8', errors='ignore').strip()

        # Check the return code AFTER communication is complete
        if process.returncode == 0:
            # Success! Print stderr if there was any (for debugging)
            if stderr_str:
                print("--- Subprocess stderr (async run) ---", file=sys.stderr)
                print(stderr_str, file=sys.stderr)
                print("--- End subprocess stderr (async run) ---", file=sys.stderr)
            # Return the captured stdout
            return stdout_str
        else:
            # The subprocess failed
            print(f"Error: Subprocess failed with return code {process.returncode}", file=sys.stderr)
            print(f"--- Subprocess stdout (if any) ---", file=sys.stderr)
            print(stdout_str, file=sys.stderr) # Print captured stdout on failure
            print(f"--- Subprocess stderr ---", file=sys.stderr)
            print(stderr_str, file=sys.stderr) # Print captured stderr on failure
            print(f"--- End subprocess error output ---", file=sys.stderr)
            return None

    except FileNotFoundError:
        # This error happens if sys.executable itself is invalid
        print(f"Error: Python interpreter '{sys.executable}' not found.", file=sys.stderr)
        return None
    except Exception as e:
        # Catch other potential errors during process creation or communication
        print(f"An unexpected error occurred during async subprocess execution: {e}", file=sys.stderr)
        # Ensure process is cleaned up if it exists and hasn't finished
        if process and process.returncode is None:
             try:
                 process.kill()
                 await process.wait()
             except Exception: pass # Ignore errors during cleanup after another error
        return None

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
async def get_gemini_models(request: ModelRequest):
    try:

        # Get available models
        models = get_gemini_models_list(api_key=request.api_key)
        
        response = ModelResponse(
            data=[ModelID(id=model) for model in models]
        )
        
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/groq/models")
async def get_groq_models(request: ModelRequest):
    try:
        
        # Get available models
        models = get_groq_models_list(api_key=request.api_key)
               
        response = ModelResponse(
            data=[ModelID(id=model.get('id')) for model in models]
        )
        
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    # Add request to active requests
    request_id = id(request)
    
    # Ensure active_requests exists
    if not hasattr(app.state, 'active_requests'):
        app.state.active_requests = set()
    
    app.state.active_requests.add(request_id)
    print(f"Added request {request_id} to active_requests")
    
    # Add cleanup task
    async def cleanup():
        if hasattr(app.state, 'active_requests'):
            app.state.active_requests.remove(request_id)
            print(f"Removed request {request_id} from active_requests")
    
    background_tasks.add_task(cleanup)

    # Filter out empty messages before any processing
    request.conversation = filter_conversation(request.conversation)

    print(f"Provider: {request.model.provider}")
    print(f"Model Name: {request.model.name}")
    print(f"Web Search: {request.web_search}")

    history = request.conversation[:-1]
    last_message = request.conversation[-1]
        
    if request.web_search:
        web_search_results = await run_web_search_and_get_context_async(last_message.content)
    else:
        web_search_results = ""
        # sources = []

    # sources = []
    system_prompt = web_search_results
    print(web_search_results)
    # sources = sources + sources

    if system_prompt:
        formatted_prompt = prompt_with_context(context=web_search_results, query=last_message.content)
    else:
        formatted_prompt = base_prompt(last_message.content)

    formatted_message = Message(
        role="user",
        content=formatted_prompt[0]["content"]
    )
    
    request.conversation = history + [formatted_message]

    # Create request state
    state = RequestState(request_id, app)

    return await handle_chat_request(request, state, request.model.provider.lower())

async def handle_chat_request(chat_request: ChatRequest, state: RequestState, provider: str):
    if provider == "ollama":
        return await chat_ollama(chat_request, state)
    elif provider == "huggingface":
        return await chat_huggingface(chat_request, state)
    elif provider == "openrouter":
        return await chat_openrouter(chat_request, state)
    elif provider == "groq":
        return await chat_groq(chat_request, state)
    elif provider == "gemini":
        return await chat_gemini(chat_request, state)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")



if __name__ == "__main__":

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 