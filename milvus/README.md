# Milvus Docker Setup with Test Scripts

This directory contains the Docker configuration and initialization scripts for Milvus vector database.

## Overview

When the Milvus Docker container starts, it automatically:

1. Starts the Milvus server
2. Creates a collection with the predefined schema
3. Ingests a test entity with a predictable vector pattern
4. Verifies the collection is ready

## Test Entity Details

The test entity ingested during startup:

- **chunk_id**: 1
- **fileID**: TEST_ENTITY_001
- **filename**: test-document.pdf
- **file_hash**: d41d8cd98f00b204e9800998ecf8427e (MD5 hash example)
- **page**: 1
- **chunk_index**: 0
- **chunk_text**: "This is a test chunk of text from the test document."
- **summary**: "Test document summary for verification purposes."
- **location**: https://drive.google.com/file/d/TEST_ENTITY_001/view
- **vector pattern**: First 64 dimensions = 0.5, Last 64 dimensions = 0.8

## Files

- `Dockerfile` - Custom Milvus image with Node.js
- `entrypoint.sh` - Container startup script
- `init-milvus.js` - Initialization script (runs on startup)
- `milvus-handler.js` - Reusable handler functions
- `test-ingest.js` - Standalone test ingestion script
- `test-query.js` - Query test script to verify database
- `package.json` - Node.js dependencies

## Usage

### Start the Milvus services

```bash
# Start etcd, minio, and milvus-standalone
docker-compose up -d etcd minio standalone

# Wait for services to be healthy (~30 seconds)
docker-compose ps
```

### Initialize the database

Run the initialization script to create the collection and ingest test data:

```bash
# Run the milvus-init container
docker-compose up milvus-init
```

Or run the initialization manually:

```bash
# Install dependencies (first time only)
cd milvus && npm install

# Run initialization
node init-milvus.js
```

### Verify the database is working

Run the test query script:

```bash
cd milvus
node test-query.js
```

### Expected output

If successful, you should see:

```
SUCCESS: Test entity retrieved successfully!
Vector database is working correctly.
Milvus is ready for production use.
```

### Re-run test ingestion

If you need to re-ingest test data:

```bash
cd milvus
node test-ingest.js
```

This will drop and recreate the collection, then ingest the test entity.

## Schema

The collection uses the following schema:

| Field       | Type          | Description                                      |
| ----------- | ------------- | ------------------------------------------------ |
| chunk_id    | Int64         | Primary key (auto_id: false, must be provided)  |
| fileID      | VarChar(100)  | Google Drive file ID                             |
| filename    | VarChar(255)  | Human-readable filename                          |
| file_hash   | VarChar(32)   | MD5 hash for change detection                    |
| page        | Int32         | Page number in the document                      |
| chunk_index | Int32         | Chunk index within the page (0-based)            |
| chunk_text  | VarChar(8000) | Actual text content of the chunk                 |
| summary     | VarChar(2000) | Per-page summary                                 |
| location    | VarChar(255)  | Google Drive link (webViewLink)                  |
| chunk       | FloatVector   | 128-dimensional embedding vector                 |

## Vector Index

- **Index type**: HNSW
- **Metric**: COSINE similarity
- **Parameters**: M=16, efConstruction=200
