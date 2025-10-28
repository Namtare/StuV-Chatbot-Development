import os
import hashlib
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from PyPDF2 import PdfReader

#Config
MILVUS_HOST = "127.0.0.1"
MILVUS_PORT = "19530"
COLLECTION_NAME = "test"
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2
PDF_DIR = "./pdf"

#Connect to DB
connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT)


#Functions for embedding new files
def get_pdf_hash(file_path):
    """Create a hash fingerprint for a PDF to detect content changes."""
    with open(file_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def load_and_split_pdf(file_path):
    """Extract text from PDF and split into chunks."""
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = splitter.split_text(text)
    return chunks


def get_embedding_model():
    """Load embedding model."""
    return SentenceTransformer("all-MiniLM-L6-v2")


def get_embeddings(texts, model):
    """Generate embeddings for text chunks."""
    return model.encode(texts, show_progress_bar=True).tolist()



def create_collection_if_not_exists():
    """Create collection if missing."""
    if COLLECTION_NAME in utility.list_collections():
        print(f"Collection '{COLLECTION_NAME}' already exists.")
        return Collection(COLLECTION_NAME)

    print(f"Creating collection '{COLLECTION_NAME}' ...")

    fields = [
        FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
        FieldSchema(name="file_name", dtype=DataType.VARCHAR, max_length=255),
        FieldSchema(name="file_hash", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="chunk_text", dtype=DataType.VARCHAR, max_length=2000),
        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM),
    ]
    schema = CollectionSchema(fields, description="PDF embeddings with file hash check")

    collection = Collection(name=COLLECTION_NAME, schema=schema)
    collection.create_index(
        field_name="embedding",
        index_params={"index_type": "IVF_FLAT", "metric_type": "COSINE", "params": {"nlist": 1024}},
    )
    print(f"Collection '{COLLECTION_NAME}' created.")
    return collection


def get_existing_hashes(collection):
    """Fetch all stored file hashes from Milvus."""
    collection.load()
    try:
        results = collection.query(
            expr="id >= 0",
            output_fields=["file_name", "file_hash"],
            limit=10000  
        )
        return {r["file_name"]: r["file_hash"] for r in results}
    except Exception as e:
        print(f"Could not query existing hashes: {e}")
        return {}


def insert_embeddings(collection, file_name, file_hash, chunks, embeddings):
    """Insert new embeddings into Milvus."""
    entities = [
        [file_name] * len(chunks),
        [file_hash] * len(chunks),
        chunks,
        embeddings,
    ]
    collection.insert(entities)
    print(f"Inserted {len(chunks)} chunks from '{file_name}' into Milvus.")


def main():
    collection = create_collection_if_not_exists()
    existing_hashes = get_existing_hashes(collection)
    model = get_embedding_model()

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
                collection.delete(expr=f"file_name == '{pdf_file}'")

        chunks = load_and_split_pdf(file_path)
        embeddings = get_embeddings(chunks, model)
        insert_embeddings(collection, pdf_file, file_hash, chunks, embeddings)

    print("All PDFs processed")


if __name__ == "__main__":
    main()
