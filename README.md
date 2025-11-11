This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Prerequisites

- Node.js (v18 or higher)
- Docker
- Python 3.x (for PDF ingestion)

## Project Structure

- `/milvus` - Vector database setup and JavaScript handlers
- `/scripts-milvus` - Python PDF ingestion scripts
- `/ollama` - Ollama LLM setup
- `/app` - Next.js application
- `.env` - Environment configuration (see below)

## Environment Configuration

The project uses environment variables defined in `.env`. Key Milvus-related variables:

```env
MILVUS_HOST=localhost
MILVUS_PORT=19530
COLLECTION_NAME=test
EMBEDDING_DIM=384
PDF_DIR=./pdf
```

These are automatically loaded by both JavaScript and Python scripts.

## Getting Started (without Ollama)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Getting Milvus Vector Database to work

**Prerequisites:**
- Docker

**Quick Start:**

1. Start all services (Milvus, etcd, MinIO):
   ```bash
   docker-compose up -d
   ```

2. Wait for services to be healthy (~30-60 seconds):
   ```bash
   docker-compose ps
   ```

3. The `milvus-init` container runs automatically and:
   - Creates the `test` collection
   - Ingests a test entity
   - Verifies the database is ready

For detailed documentation, see [`./milvus/README.md`](./milvus/README.md).

## PDF Ingestion Pipeline

A Python script is available to ingest PDF documents into the Milvus vector database.

**Prerequisites:**
```bash
pip install pymilvus langchain-text-splitters sentence-transformers PyPDF2 python-dotenv
```

**Usage:**

1. Place PDF files in the `./pdf` directory
2. Ensure Milvus is running
3. Run the ingestion script:
   ```bash
   python scripts-milvus/milvus-pdf.py
   ```

**Features:**
- Automatic text chunking (1000 chars with 100 char overlap)
- Page number tracking
- MD5 hash-based deduplication
- Auto-updates for modified files

## Getting Ollama to work

**Prerequisites:**
- Docker

Follow the steps in `README.md` in ./ollama/ to start ollama locally and installing the model locally. Then just run the application with `npm run dev` and you can chat with the model. The response times are a little higher 30-40seconds currently.

### TODO

- reducing response time by changing architecture to RAG first, LLM response optional
- reduce response time by changing architecture to RAG first, then A2A for efficient extension of context and response capabilities

### Features To Add

- [once we get a google Cloud project] different Groups can see different parts of the same Google Cloud
- ~~[For Vector-Database] create a webinterface in which you can upload your pdfs to add to the DB~~ → CLI tool available (`scripts-milvus/milvus-pdf.py`)
- [Enhancement] Web interface for PDF uploads (CLI currently available)

### Project changes when going prod

- different application type (from desktop-app to webapp)
- might Need to Change the Transport between Server and Client (from stdio to http) depending on where Servers will live (apart from or together with Node-app)
