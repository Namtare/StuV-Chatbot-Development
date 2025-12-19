import os
import hashlib
from pymilvus import connections, Collection
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from PyPDF2 import PdfReader
import pandas as pd
import markdown
import fitz 
from dotenv import load_dotenv
import anthropic

load_dotenv()

# ENV CONFIG
MILVUS_HOST = os.environ["MILVUS_HOST"]
MILVUS_PORT = os.environ["MILVUS_PORT"]
CHUNKS_COLLECTION_NAME = os.environ.get("CHUNKS_COLLECTION_NAME", "test")
PAGES_COLLECTION_NAME = os.environ.get("PAGES_COLLECTION_NAME", "page_with_meta")
EMBEDDING_DIM = int(os.environ["EMBEDDING_DIM"])
PDF_DIR = os.environ["PDF_DIR"]

connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT)

# helpers
def get_pdf_hash(file_path):
    """MD5 hash to detect changes."""
    with open(file_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def get_all_documents_recursive(base_dir):
    """Find PDF, XLSX, MD files recursively."""
    supported_exts = (".pdf", ".xlsx", ".md")
    files = []
    for root, dirs, filenames in os.walk(base_dir):
        for fname in filenames:
            if fname.lower().endswith(supported_exts):
                files.append(os.path.join(root, fname))
    return files


# fallback for ocr
def extract_text_with_ocr(file_path):
    """OCR fallback for PDFs."""
    print(f"⚠️ OCR fallback activated for {file_path}")
    doc = fitz.open(file_path)
    text = ""

    from PIL import Image
    import pytesseract
    from io import BytesIO

    for page in doc:
        pix = page.get_pixmap()
        img_bytes = pix.tobytes("png")
        img = Image.open(BytesIO(img_bytes))
        text += pytesseract.image_to_string(img) + "\n"

    return text


# load pdfs
def load_and_split_pdf(file_path, file_id):
    reader = PdfReader(file_path)
    chunks_with_pages = []
    pages_with_meta = []

    for page_num, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        if not text.strip():
            text = extract_text_with_ocr(file_path)

        if not text.strip():
            continue

        page_id = f"{file_id}_page_{page_num}"
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = splitter.split_text(text)

        for chunk in chunks:
            chunks_with_pages.append({"text": chunk, "page": page_id})

        pages_with_meta.append({
            "page_id": page_id,
            "page_text": text,
            "file_id": file_id,
            "local_page_num": page_num
        })

    return chunks_with_pages, pages_with_meta


# load xlsx
def load_and_split_xlsx(file_path, file_id):
    try:
        excel = pd.ExcelFile(file_path)
    except Exception as e:
        print(f"❌ XLSX read error: {e}")
        return [], []

    text = ""
    for sheet in excel.sheet_names:
        df = excel.parse(sheet).fillna("")
        sheet_text = df.astype(str).agg(" | ".join, axis=1).str.cat(sep="\n")
        text += f"\n=== Sheet: {sheet} ===\n{sheet_text}\n"

    if not text.strip():
        return [], []

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = splitter.split_text(text)

    page_id = f"{file_id}_page_1"

    chunks_with_pages = [{"text": c, "page": page_id} for c in chunks]
    pages_with_meta = [{
        "page_id": page_id,
        "file_id": file_id,
        "local_page_num": 1,
        "page_text": text
    }]

    return chunks_with_pages, pages_with_meta


# load markdown
def load_and_split_markdown(file_path, file_id):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            md = f.read()
    except Exception as e:
        print(f"❌ Markdown read error: {e}")
        return [], []

    html = markdown.markdown(md)
    text = html.replace("<p>", "").replace("</p>", "\n")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = splitter.split_text(text)

    page_id = f"{file_id}_page_1"
    chunks_with_pages = [{"text": c, "page": page_id} for c in chunks]

    pages_with_meta = [{
        "page_id": page_id,
        "file_id": file_id,
        "local_page_num": 1,
        "page_text": text
    }]

    return chunks_with_pages, pages_with_meta


# embeddings
def get_embedding_model():
    return SentenceTransformer("all-MiniLM-L6-v2")


def get_embeddings(texts, model):
    if not texts:
        return []
    return model.encode(texts, show_progress_bar=True).tolist()


# Database helpers
def get_existing_hashes(collection):
    collection.load()
    try:
        res = collection.query(
            expr="chunk_id >= 0",
            output_fields=["filename", "file_hash"],
            limit=100000
        )
        return {r["filename"]: r["file_hash"] for r in res}
    except:
        return {}


def get_existing_page_ids(page_collection):
    page_collection.load()
    try:
        res = page_collection.query(
            expr="local_page_num >= 0",
            output_fields=["page_id"],
            limit=100000
        )
        return {r["page_id"] for r in res}
    except:
        return set()


def get_max_chunk_id(collection):
    collection.load()
    try:
        res = collection.query(
            expr="chunk_id >= 0",
            output_fields=["chunk_id"],
            limit=100000
        )
        return max((r["chunk_id"] for r in res), default=-1)
    except:
        return -1


def insert_embeddings(collection, file_name, file_hash, chunks_data, embeddings, start_chunk_id):
    num_chunks = len(chunks_data)

    if num_chunks == 0:
        print(f"⚠️ No chunks for {file_name}, skipping.")
        return

    if not embeddings or len(embeddings) != num_chunks:
        print(f"⚠️ Embedding mismatch ({len(embeddings)} vs {num_chunks}). Skipping.")
        return

    file_id = os.path.splitext(file_name)[0]

    entities = [
        list(range(start_chunk_id, start_chunk_id + num_chunks)),
        [file_id] * num_chunks,
        [file_name] * num_chunks,
        [file_hash] * num_chunks,
        [c["page"] for c in chunks_data],
        list(range(num_chunks)),
        [c["text"] for c in chunks_data],
        [
            c["text"][:200] + "..." if len(c["text"]) > 200 else c["text"]
            for c in chunks_data
        ],
        [PDF_DIR] * num_chunks,
        embeddings
    ]

    collection.insert(entities)
    print(f"✓ Inserted {num_chunks} chunks from '{file_name}'")


# page summaries
def insert_page_summaries(page_collection, pages_data, existing_page_ids, model):
    import time

    new_pages = [p for p in pages_data if p['page_id'] not in existing_page_ids]
    if not new_pages:
        print("No new pages to summarize.")
        return

    print(f"\n{'='*70}")
    print(f"📄 Generating summaries for {len(new_pages)} pages...")
    print(f"{'='*70}")

    page_ids, file_ids, local_page_nums, summaries = [], [], [], []
    failed = []
    start = time.time()

    for i, p in enumerate(new_pages, 1):
        try:
            print(f"\n[{i}/{len(new_pages)}] Page {p['local_page_num']} from '{p['file_id']}'")
            print("  └─ Calling Claude...", end=" ", flush=True)

            summary = write_summary(p['page_text'])
            dur = time.time() - start

            print(f"✓ ({dur:.1f}s)")
            page_ids.append(p["page_id"])
            file_ids.append(p["file_id"])
            local_page_nums.append(p["local_page_num"])
            summaries.append(summary)

        except Exception as e:
            msg = str(e)
            print(f"✗ FAILED: {msg}")
            failed.append(msg)

    print(f"\n✓ Summary generation complete!")

    print(f"Generating embeddings for {len(summaries)} summaries...")
    summary_embeddings = get_embeddings(summaries, model)

    entities = [page_ids, file_ids, local_page_nums, summaries, summary_embeddings]
    page_collection.insert(entities)
    print(f"Inserted {len(new_pages)} summaries.\n")


# summaries for claude
def write_summary(pdf_text, timeout=90, max_length=550):
    """
    Generate a summary using the Claude API with strict length limitations.
    Ensures the final output NEVER exceeds Milvus varchar(600).
    """

    SYSTEMPROMPT = """You are a precise summarization assistant. Your task is to distill PDF page content into concise summaries.

CRITICAL REQUIREMENTS:
- Total length: MAXIMUM 500 characters (STRICT LIMIT - hard truncated if longer)
- Extract exactly 3 short bullet points (5-10 words each)
- Follow with a 2-3 sentence summary
- Use clear, direct language without filler words
- Focus on key insights only

FORMAT:
- Point 1
- Point 2
- Point 3

Summary: [2-3 sentences]

BE CONCISE. Every character counts."""

    # Limit input to avoid huge API payloads
    truncated_pdf = pdf_text[:10000] if len(pdf_text) > 10000 else pdf_text

    try:
        client = anthropic.Anthropic(timeout=timeout)
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=250,
            system=SYSTEMPROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Summarize this PDF page (MAX 500 chars):\n\n{truncated_pdf}"
                }
            ],
        )

        # Extract text from Claude response
        summary = message.content[0].text.strip()

        # Normalize formatting
        summary = summary.replace("\r", "").replace("\n\n", "\n").strip()

        # HARD LIMIT (Milvus max_length = 600)
        if len(summary) > max_length:
            print(f"    ⚠ Summary too long ({len(summary)} chars), truncating to {max_length}...")
            summary = summary[:max_length - 3] + "..."

        return summary

    except anthropic.APITimeoutError:
        return "[ERROR] Claude API timeout after {}s".format(timeout)

    except anthropic.APIError as e:
        return f"[ERROR] Claude API error: {str(e)[:200]}"

    except Exception as e:
        return f"[ERROR] Unexpected summary error: {str(e)[:200]}"




def main():
    chunks_col = Collection(CHUNKS_COLLECTION_NAME)
    pages_col = Collection(PAGES_COLLECTION_NAME)

    existing_hashes = get_existing_hashes(chunks_col)
    existing_pages = get_existing_page_ids(pages_col)
    model = get_embedding_model()

    next_chunk_id = get_max_chunk_id(chunks_col) + 1

    input_files = get_all_documents_recursive(PDF_DIR)

    for file_path in input_files:
        file_name = os.path.basename(file_path)
        file_id = os.path.splitext(file_name)[0]
        file_hash = get_pdf_hash(file_path)

        # skip unchanged
        if file_name in existing_hashes and existing_hashes[file_name] == file_hash:
            print(f"Skipping '{file_name}' (no changes)")
            continue

        # update changed file
        if file_name in existing_hashes:
            print(f"Updating file: {file_name}")
            chunks_col.delete(expr=f"filename == '{file_name}'")
            pages_col.delete(expr=f"file_id == '{file_id}'")

        # route by type
        if file_name.lower().endswith(".pdf"):
            chunks, pages = load_and_split_pdf(file_path, file_id)
        elif file_name.lower().endswith(".xlsx"):
            chunks, pages = load_and_split_xlsx(file_path, file_id)
        elif file_name.lower().endswith(".md"):
            chunks, pages = load_and_split_markdown(file_path, file_id)
        else:
            continue

        insert_page_summaries(pages_col, pages, existing_pages, model)
        embeddings = get_embeddings([c["text"] for c in chunks], model)
        insert_embeddings(chunks_col, file_name, file_hash, chunks, embeddings, next_chunk_id)

        next_chunk_id += len(chunks)

    print("All documents processed.")


if __name__ == "__main__":
    main()
