import os
import hashlib
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from PyPDF2 import PdfReader
from dotenv import load_dotenv
load_dotenv()

# Config from environment variables (must be set externally)
MILVUS_HOST = os.environ["MILVUS_HOST"]
MILVUS_PORT = os.environ["MILVUS_PORT"]
COLLECTION_NAME = os.environ["COLLECTION_NAME"]
EMBEDDING_DIM = int(os.environ["EMBEDDING_DIM"])
PDF_DIR = os.environ["PDF_DIR"]

#Connect to DB
connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT)


#Functions for embedding new files
def get_pdf_hash(file_path):
    """Create a hash fingerprint for a PDF to detect content changes."""
    with open(file_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def load_and_split_pdf(file_path):
    """Extract text from PDF and split into chunks with page tracking."""
    reader = PdfReader(file_path)
    chunks_with_pages = []

    for page_num, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        if page_text.strip():
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            page_chunks = splitter.split_text(page_text)
            for chunk in page_chunks:
                chunks_with_pages.append({
                    'text': chunk,
                    'page': page_num
                })

    return chunks_with_pages


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
        list(range(start_chunk_id, start_chunk_id + num_chunks)),  # chunk_id
        [file_id] * num_chunks,  # fileID
        [file_name] * num_chunks,  # filename
        [file_hash] * num_chunks,  # file_hash
        [chunk['page'] for chunk in chunks_data],  # page
        list(range(len(chunks_data))),  # chunk_index
        [chunk['text'] for chunk in chunks_data],  # chunk_text
        [chunk['text'][:200] + "..." if len(chunk['text']) > 200 else chunk['text'] for chunk in chunks_data],  # summary (first 200 chars)
        [PDF_DIR] * num_chunks,  # location (directory path)
        embeddings,  # chunk (vector)
    ]
    collection.insert(entities)
    print(f"Inserted {num_chunks} chunks from '{file_name}' into Milvus.")


def main():
    # Assume collection already exists (created by JS initialization)
    collection = Collection(COLLECTION_NAME)
    existing_hashes = get_existing_hashes(collection)
    model = get_embedding_model()

    # Get max chunk_id to continue from there
    next_chunk_id = get_max_chunk_id(collection) + 1

    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]

    for pdf_file in pdf_files:
        file_path = os.path.join(PDF_DIR, pdf_file)
        file_hash = get_pdf_hash(file_path)

        if pdf_file in existing_hashes:
            if existing_hashes[pdf_file] == file_hash:
                print(f"Skipping '{pdf_file}' (no changes).")
                continue
            else:
                print(f"Updating changed file: {pdf_file}")
                collection.delete(expr=f"filename == '{pdf_file}'")

        chunks_data = load_and_split_pdf(file_path)
        # Extract just the text for embeddings
        chunk_texts = [chunk['text'] for chunk in chunks_data]
        embeddings = get_embeddings(chunk_texts, model)
        insert_embeddings(collection, pdf_file, file_hash, chunks_data, embeddings, next_chunk_id)

        # Update next_chunk_id for the next file
        next_chunk_id += len(chunks_data)

    print("All PDFs processed")


if __name__ == "__main__":
    main()