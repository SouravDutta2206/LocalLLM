import sys
sys.dont_write_bytecode = True


from google.genai import types
import re

def prompt_with_context(context: str, query: str):

    prompt = [
        {
            "role" : "user",
            "content" : re.sub(r"[^\S\n]+", " ", f'''You are an AI assistant tasked with providing detailed answers based solely on the given context. Your goal is to analyze the information provided and formulate a comprehensive, well-structured response to the question.
                        Context: {context}
                        User Question: {query}
                        Important Instruction to follow strictly-
                        
                        To answer the question:
                        1. Thoroughly analyze the context, identifying key information relevant to the question.
                        2. Organize your thoughts and plan your response to ensure a logical flow of information.
                        3. Formulate a detailed answer that directly addresses the question, using only the information provided in the context.
                        4. Ensure your answer is comprehensive, covering all relevant aspects found in the context.
                        5. If the context doesn't contain sufficient information to fully answer the question, state this clearly in your response.
                        
                        Format your response as follows:
                        1. Use clear, concise language.
                        2. Organize your answer into paragraphs for readability.
                        3. Use bullet points or numbered lists where appropriate to break down complex information.
                        4. If relevant, include any headings or subheadings to structure your response.
                        5. Ensure proper grammar, punctuation, and spelling throughout your answer.
                        
                        Important: Base your entire response solely on the information provided in the context. Do not include any external knowledge or assumptions not present in the given text.''')
        }
    ]

    return prompt

def base_prompt(query_text: str):

    prompt = [
        {
            "role" : "user",
            "content" : re.sub(r"[^\S\n]+", " ", f'''You are an AI assistant designed to provide detailed and informative answers to user questions. Your goal is to analyze the question, draw upon your vast knowledge base, and formulate a comprehensive, well-structured response.
                        User Question: {query_text}
                        Important Instruction to follow strictly-
                        
                        To answer the question:
                        1. Thoroughly analyze the question, identifying key information and its underlying intent.
                        2. Organize your thoughts and plan your response to ensure a logical flow of information and a clear articulation of your understanding.
                        3. Formulate a detailed answer that directly addresses the question, drawing upon your extensive knowledge and reasoning capabilities.
                        4. Ensure your answer is comprehensive, covering all relevant aspects and perspectives.
                        5. Acknowledge any limitations in your knowledge or understanding, and suggest avenues for further exploration if appropriate.
                        
                        Format your response as follows:
                        1. Use clear, concise, and accurate language.
                        2. Organize your answer into paragraphs for readability and a clear progression of ideas.
                        3. Use bullet points or numbered lists where appropriate to break down complex information or present a series of related points.
                        4. If relevant, include any headings or subheadings to structure your response.
                        5. Ensure proper grammar, punctuation, and spelling throughout your answer.
                        
                        Important: Base your entire response solely on the information provided in the context. Do not include any external knowledge or assumptions not present in the given text.''')
        }
    ]

    return prompt


def gemini_prompt_format(prompt: list):

    content = []

    for i, message in enumerate(prompt):

        if message["role"] == "user":
            content.append(types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=message["content"]),
                ],
            ))
            
        if message["role"] == "assistant":
            content.append(types.Content(
                role="model",
                parts=[
                    types.Part.from_text(text=message["content"]),
                ],
            ))

    gen_config = types.GenerateContentConfig(
        response_mime_type="text/plain",
    )

    return content , gen_config




