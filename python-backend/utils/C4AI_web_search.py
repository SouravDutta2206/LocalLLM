import argparse
import asyncio
import os
process_env = os.environ.copy()
process_env["PYTHONIOENCODING"] = "utf-8"

import sys
if sys.platform.startswith('win'):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import shutil
from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
from crawl4ai.content_filter_strategy import BM25ContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from crawl4ai.models import CrawlResult
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_chroma import Chroma
from chromadb.api.client import SharedSystemClient
from get_embedding_function import hf_local_embeddings
from duckduckgo_search import DDGS
from googlesearch import search


CHROMA_PATH = os.path.join(os.getcwd(), 'python-backend', "web-search-llm-db")

num_result = 10

def google_search(search_term : str , num_results : int = num_result) -> list[str]:
    print("using Google Search", file=sys.stderr)
    return [urls for urls in search(search_term, num_results=num_results)]

def DDGS_search(search_term : str , num_results : int = num_result) -> list[str]:
    print("using DuckDuckGo Search")
    results = DDGS().text(search_term, max_results=num_results)
    return [result["href"] for result in results]

def get_web_urls(search_term: str, num_results: int = num_result) -> list[str]:

    discard_urls = ["youtube.com", "britannica.com", "vimeo.com", "accuweather.com"]

    for url in discard_urls:
        search_term += f" -site:{url}"

    search_engines = [DDGS_search, google_search]

    for i , func in enumerate(search_engines):

        try:

            return func(search_term=search_term, num_results=num_results)
        
        except Exception as e:

            print(f"Attempt {i + 1} ({func.__name__}) Failed: {e}")

    print("Web Search failed")
    return None
 
def normalize_url(url):

    normalized_url = (
        url.replace("https://", "")
        .replace("www.", "")
        .replace("/", "_")
        .replace("-", "_")
        .replace(".", "_")
    )
    # print("Normalized URL", normalized_url)
    return normalized_url

def split_documents(documents: list[Document]):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=80,
        length_function=len,
        separators=["\n\n", "\n", ".", "?", "!", " ", ""]
    )
    return text_splitter.split_documents(documents)

async def crawl_webpages(urls: list[str], prompt: str) -> CrawlResult:

    bm25_filter = BM25ContentFilter(user_query=prompt, bm25_threshold=1.2)
    md_generator = DefaultMarkdownGenerator(content_filter=bm25_filter)

    crawler_config = CrawlerRunConfig(
        markdown_generator=md_generator,
        excluded_tags=["nav", "footer", "header", "form", "img", "a"],
        only_text=True,
        exclude_social_media_links=True,
        exclude_external_links=True,
        keep_data_attributes=False,
        cache_mode=CacheMode.BYPASS,
        remove_overlay_elements=True,
        user_agent="Chrome/135.0.0.0",
        page_timeout=20000,  # in ms: 20 seconds
        verbose=False,
        scan_full_page=True,
        magic=True,

    )
        # user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    browser_config = BrowserConfig(headless=True, text_mode=True, light_mode=True)

    results = []
    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            results = await crawler.arun_many(urls=urls, config=crawler_config)
    except Exception as e:
        print(f"Error during crawling: {e}", file=sys.stderr)
        # Optionally re-raise or handle differently
    finally:
        return results
    
async def web_search(prompt: str):

    urls = get_web_urls(search_term=prompt, num_results=num_result)
    if not urls:
        print("Could not retrieve URLs for crawling.", file=sys.stderr)
        if os.path.exists(CHROMA_PATH):
             delete_database()
        return ""

    print("URLs to crawl:", urls, file=sys.stderr)
    results = await crawl_webpages(urls=urls, prompt=prompt)

    docs = ""
    markdown_data = []
    successful_urls = []

    if not results:
        print("Failed to get crawl results", file=sys.stderr)
        return ""

    for i , result in enumerate(results):

        source_url = urls[i]
        norm_url = normalize_url(source_url)

        if result and result.markdown and result.markdown.fit_markdown:
                            markdown_result = result.markdown.fit_markdown
                            # Create a separate doc for each successful crawl
                            new_doc = Document(metadata={'id': norm_url, 'source': source_url},
                                            page_content=markdown_result)
                            markdown_data.append(new_doc)
                            successful_urls.append(source_url)
        else: 
            print(f"No valid markdown content found for URL: {source_url}", file=sys.stderr)
       
    if not markdown_data:
        print("No documents generated after crawling.", file=sys.stderr)
        if os.path.exists(CHROMA_PATH):
             delete_database()
        return ""
            
    # context_text_str = [doc.page_content for doc in markdown_data]
    # context_text_str = "\n".join(context_text_str)
    all_splits = split_documents(markdown_data)

    if not all_splits:
        print("No text splits generated from documents.", file=sys.stderr)
        # Clean up DB path
        if os.path.exists(CHROMA_PATH):
             delete_database()
        return ""
    
    db = None
    context_text_str = ""

    try:
    
        embedding_function = hf_local_embeddings('intfloat/e5-small-v2')

        db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embedding_function, collection_name="web-search-llm")

        db.add_documents(all_splits)

        search_docs = db.similarity_search_with_score(prompt, k=5)

        context_text = [doc.page_content for doc, _score in search_docs]
        sources = [doc.metadata['source'] for doc, _score in search_docs]

        context_text_str = "\n".join(map(str, context_text))

    except Exception as e:
        print(f"An error occurred during DB operations or LLM query: {e}", file=sys.stderr)
        delete_database(db=db)

    delete_database(db=db)

    return context_text_str

def delete_database(db = None):

    try:

        if db is not None:
                db._client._system.stop()
                SharedSystemClient._identifier_to_system.pop(db._client._identifier, None)
                db = None
            
        shutil.rmtree(CHROMA_PATH)

    except Exception as e:
            print(f"Error removing directory {CHROMA_PATH}: {e}", file=sys.stderr)
   
if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="Crawl web pages based on a search prompt and extract relevant context.")
    parser.add_argument("prompt", type=str, help="The search prompt to use for finding and filtering web pages.")
    args = parser.parse_args()

    returned_context = asyncio.run(web_search(prompt=args.prompt))
    print(returned_context)



