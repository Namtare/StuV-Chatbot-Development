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

- **chunk_id**: 999
- **fileID**: TEST_ENTITY_001
- **location**: test/data/test-document.pdf
- **page**: 1
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

### Start the Milvus container

```bash
docker-compose up --build standalone
```

The container will automatically create the collection and ingest the test entity.

### Verify the database is working

Run the test query script inside the container:

```bash
docker exec milvus-standalone node /app/test-query.js
```

Or using npm:

```bash
docker exec milvus-standalone npm run test:query
```

### Expected output

If successful, you should see:

```
SUCCESS: Test entity retrieved successfully!
Vector database is working correctly.
Milvus is ready for production use.
```

### Re-run initialization manually

If you need to re-initialize:

```bash
docker exec milvus-standalone node /app/init-milvus.js
```

Or:

```bash
docker exec milvus-standalone npm run init
```

## Schema

The collection uses the following schema:

| Field    | Type         | Description               |
| -------- | ------------ | ------------------------- |
| chunk_id | Int64        | Primary key               |
| page     | Int32        | Page number               |
| fileID   | VarChar(100) | Document identifier       |
| location | VarChar(255) | Document location/path    |
| chunk    | FloatVector  | 128-dimensional embedding |

## Vector Index

- **Index type**: HNSW
- **Metric**: COSINE similarity
- **Parameters**: M=16, efConstruction=200
