import os
import hashlib
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from PyPDF2 import PdfReader
from dotenv import load_dotenv
import anthropic
load_dotenv()

# Config from environment variables (must be set externally)
MILVUS_HOST = os.environ["MILVUS_HOST"]
MILVUS_PORT = os.environ["MILVUS_PORT"]
COLLECTION_NAME = os.environ["COLLECTION_NAME"]
PAGE_COLLECTION_NAME = os.environ.get("PAGE_COLLECTION_NAME", "page_with_meta")  # New collection name
EMBEDDING_DIM = int(os.environ["EMBEDDING_DIM"])
PDF_DIR = os.environ["PDF_DIR"]

#Connect to DB
connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT)


#Functions for embedding new files
def get_pdf_hash(file_path):
    """Create a hash fingerprint for a PDF to detect content changes."""
    with open(file_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def load_and_split_pdf(file_path, file_id):
    """Extract text from PDF and split into chunks with global page tracking."""
    reader = PdfReader(file_path)
    chunks_with_pages = []
    pages_with_meta = []

    for page_num, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        if page_text.strip():
            # Create globally unique page_id
            page_id = f"{file_id}_page_{page_num}"
            
            # Split page into chunks
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            page_chunks = splitter.split_text(page_text)
            
            for chunk in page_chunks:
                chunks_with_pages.append({
                    'text': chunk,
                    'page_id': page_id  # Now global, not local
                })
            
            # Store page metadata (one per page, no duplication)
            pages_with_meta.append({
                'page_id': page_id,
                'page_text': page_text,  # For summary generation
                'file_id': file_id,
                'local_page_num': page_num
            })

    return chunks_with_pages, pages_with_meta


def get_embedding_model():
    """Load embedding model."""
    return SentenceTransformer("all-MiniLM-L6-v2")


def get_embeddings(texts, model):
    """Generate embeddings for text chunks."""
    return model.encode(texts, show_progress_bar=True).tolist()


def get_existing_hashes(collection):
    """Fetch all stored file hashes from Milvus."""
    collection.load()
    try:
        results = collection.query(
            expr="chunk_id >= 0",
            output_fields=["filename", "file_hash"],
            limit=10000
        )
        return {r["filename"]: r["file_hash"] for r in results}
    except Exception as e:
        print(f"Could not query existing hashes: {e}")
        return {}


def get_existing_page_ids(page_collection):
    """Fetch all stored page_ids from page collection to avoid duplicates."""
    page_collection.load()
    try:
        results = page_collection.query(
            expr="local_page_num >= 0",
            output_fields=["page_id"],
            limit=50000
        )
        return {r["page_id"] for r in results}
    except Exception as e:
        print(f"Could not query existing page_ids: {e}")
        return set()


def get_max_chunk_id(collection):
    """Get the maximum chunk_id from the collection."""
    collection.load()
    try:
        results = collection.query(
            expr="chunk_id >= 0",
            output_fields=["chunk_id"],
            limit=10000
        )
        if results:
            return max(r["chunk_id"] for r in results)
        return -1
    except Exception as e:
        print(f"Could not query max chunk_id: {e}")
        return -1


def insert_embeddings(collection, file_name, file_hash, chunks_data, embeddings, start_chunk_id):
    """Insert new embeddings into Milvus with all required fields."""
    num_chunks = len(chunks_data)

    # Generate fileID from filename (remove extension and use as ID)
    file_id = os.path.splitext(file_name)[0]

    entities = [
        list(range(start_chunk_id, start_chunk_id + num_chunks)),  # chunk_id --> Milvus primary key
        [file_id] * num_chunks,  # fileID
        [file_name] * num_chunks,  # filename
        [file_hash] * num_chunks,  # file_hash
        [chunk['page_id'] for chunk in chunks_data],  # page_id (NOW GLOBAL!)
        list(range(len(chunks_data))),  # chunk_index --> pdf-wide chunk location
        [chunk['text'] for chunk in chunks_data],  # chunk_text
        [chunk['text'][:200] + "..." if len(chunk['text']) > 200 else chunk['text'] for chunk in chunks_data],  # summary (first 200 chars - only for testing purposes!)
        [PDF_DIR] * num_chunks,  # location (directory path)
        embeddings,  # chunk (vector)
    ]
    collection.insert(entities)
    print(f"Inserted {num_chunks} chunks from '{file_name}' into Milvus.")


def insert_page_summaries(page_collection, pages_data, existing_page_ids):
    """Insert page summaries into the page metadata collection."""
    # Filter out pages that already exist
    new_pages = [p for p in pages_data if p['page_id'] not in existing_page_ids]
    
    if not new_pages:
        print("No new pages to summarize.")
        return
    
    print(f"Generating summaries for {len(new_pages)} pages...")
    
    page_ids = []
    file_ids = []
    local_page_nums = []
    summaries = []
    
    for page_data in new_pages:
        # Generate summary using Claude
        summary = write_summary(page_data['page_text'])
        
        page_ids.append(page_data['page_id'])
        file_ids.append(page_data['file_id'])
        local_page_nums.append(page_data['local_page_num'])
        summaries.append(summary)
    
    # Insert into page collection
    entities = [
        page_ids,
        file_ids,
        local_page_nums,
        summaries
    ]
    
    page_collection.insert(entities)
    print(f"Inserted {len(new_pages)} page summaries into {PAGE_COLLECTION_NAME}.")


def write_summary(pdf):
    SYSTEMPROMPT = """You are a precise summarization assistant. Your task is to distill PDF page content into concise summaries.

OUTPUT REQUIREMENTS:
- Extract exactly 3 main points as bullet points
- Follow with a 2-4 sentence summary of the page
- Total length: 300-400 characters (strict maximum)
- Be exhaustive within the character limit - prioritize information density
- Use clear, direct language without filler words
- Focus on key insights, not peripheral details

FORMAT:
- Main point 1
- Main point 2
- Main point 3

Summary: [2-4 concise sentences capturing the essence and context of the page]

Optimize for clarity and information value per character."""
    
    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        system=SYSTEMPROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Summarize this PDF page:\n\n{pdf}"
            }
        ],
    )

    return message.content[0].text


def main():
    # Assume both collections already exist
    collection = Collection(COLLECTION_NAME)
    page_collection = Collection(PAGE_COLLECTION_NAME)
    
    existing_hashes = get_existing_hashes(collection)
    existing_page_ids = get_existing_page_ids(page_collection)
    model = get_embedding_model()

    # Get max chunk_id to continue from there
    next_chunk_id = get_max_chunk_id(collection) + 1

    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]

    for pdf_file in pdf_files:
        file_path = os.path.join(PDF_DIR, pdf_file)
        file_hash = get_pdf_hash(file_path)
        file_id = os.path.splitext(pdf_file)[0]

        if pdf_file in existing_hashes:
            if existing_hashes[pdf_file] == file_hash:
                print(f"Skipping '{pdf_file}' (no changes).")
                continue
            else:
                print(f"Updating changed file: {pdf_file}")
                collection.delete(expr=f"filename == '{pdf_file}'")
                # Also delete old page summaries for this file
                page_collection.delete(expr=f"file_id == '{file_id}'")

        # Load PDF and get both chunks and page metadata
        chunks_data, pages_data = load_and_split_pdf(file_path, file_id)
        
        # Insert page summaries FIRST (so they exist before chunks reference them)
        insert_page_summaries(page_collection, pages_data, existing_page_ids)
        
        # Then insert chunks with embeddings
        chunk_texts = [chunk['text'] for chunk in chunks_data]
        embeddings = get_embeddings(chunk_texts, model)
        insert_embeddings(collection, pdf_file, file_hash, chunks_data, embeddings, next_chunk_id)

        # Update next_chunk_id for the next file
        next_chunk_id += len(chunks_data)

    print("All PDFs processed")


if __name__ == "__main__":
    main()