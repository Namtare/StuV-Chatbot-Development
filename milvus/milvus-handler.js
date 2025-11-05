import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

// Milvus connection configuration
const MILVUS_CONFIG = {
  address: process.env.MILVUS_ADDRESS || 'localhost:19530',
  username: process.env.MILVUS_USERNAME,
  password: process.env.MILVUS_PASSWORD,
  ssl: false,
};

// Collection configuration
const COLLECTION_NAME = 'first_collection';

// will depend on the embedding model used
const VECTOR_DIM = 128;

// Schema definition
const SCHEMA = [
  {
    name: 'chunk_id',
    data_type: DataType.Int64,
    is_primary_key: true,
    auto_id: false,
  },
  { name: 'page', data_type: DataType.Int32 },
  { name: 'fileID', data_type: DataType.VarChar, max_length: 100 },
  { name: 'location', data_type: DataType.VarChar, max_length: 255 },
  { name: 'chunk', data_type: DataType.FloatVector, dim: VECTOR_DIM },
];

// Index configuration
const INDEX_CONFIG = {
  field_name: 'chunk',
  index_type: 'HNSW',
  metric_type: 'COSINE',
  params: {
    M: 16,
    efConstruction: 200,
  },
};

// Initialize Milvus client (singleton)
let client = null;

/**
 * Get or create the Milvus client connection
 * @returns {MilvusClient} Milvus client instance
 */
function getClient() {
  if (!client) {
    client = new MilvusClient(MILVUS_CONFIG);
  }
  return client;
}

/**
 * Create a collection with the predefined schema
 * @param {string} collectionName - Name of the collection (defaults to COLLECTION_NAME)
 * @param {boolean} dropIfExists - Whether to drop the collection if it already exists
 * @returns {Promise<Object>} Result of collection creation
 */
export async function createCollection(
  collectionName = COLLECTION_NAME,
  dropIfExists = false
) {
  const milvusClient = getClient();

  // Check if collection exists
  const hasCollection = await milvusClient.hasCollection({
    collection_name: collectionName,
  });

  if (hasCollection.value) {
    if (dropIfExists) {
      console.log(`Collection '${collectionName}' exists, dropping it...`);
      await milvusClient.dropCollection({
        collection_name: collectionName,
      });
    } else {
      console.log(`Collection '${collectionName}' already exists.`);
      return { success: true, message: 'Collection already exists' };
    }
  }

  // Create collection
  console.log(`Creating collection '${collectionName}'...`);
  await milvusClient.createCollection({
    collection_name: collectionName,
    description: 'Collection for document chunks and embeddings',
    fields: SCHEMA,
  });

  // Create index on vector field
  console.log('Creating index on vector field...');
  await milvusClient.createIndex({
    collection_name: collectionName,
    ...INDEX_CONFIG,
  });

  console.log(`Collection '${collectionName}' created successfully.`);
  return { success: true, message: 'Collection created successfully' };
}

/**
 * Ingest data into the collection
 * @param {Array<Object>} data - Array of data objects matching the schema
 * @param {string} collectionName - Name of the collection (defaults to COLLECTION_NAME)
 * @returns {Promise<Object>} Result of data insertion
 */
export async function ingestData(data, collectionName = COLLECTION_NAME) {
  const milvusClient = getClient();

  // Validate data
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Data must be a non-empty array');
  }

  // Insert data
  console.log(`Inserting ${data.length} records into '${collectionName}'...`);
  const insertRes = await milvusClient.insert({
    collection_name: collectionName,
    data: data,
  });

  // Flush to ensure data is persisted
  console.log('Flushing data...');
  await milvusClient.flush({
    collection_names: [collectionName],
  });

  // Load collection into memory if not already loaded
  console.log('Loading collection into memory...');
  await milvusClient.loadCollection({
    collection_name: collectionName,
  });

  // Wait for collection to be fully loaded
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`Successfully ingested ${data.length} records.`);
  return {
    success: true,
    insertCount: insertRes.insert_cnt || data.length,
    message: 'Data ingested successfully',
  };
}

/**
 * Search for similar vectors in the collection
 * @param {Array<number>} queryVector - Query vector for similarity search
 * @param {number} limit - Maximum number of results to return
 * @param {Array<string>} outputFields - Fields to include in the results
 * @param {string} collectionName - Name of the collection (defaults to COLLECTION_NAME)
 * @returns {Promise<Object>} Search results
 */
export async function search(
  queryVector,
  limit = 5,
  outputFields = ['fileID', 'location', 'page'],
  collectionName = COLLECTION_NAME
) {
  const milvusClient = getClient();

  // Validate query vector
  if (!Array.isArray(queryVector) || queryVector.length !== VECTOR_DIM) {
    throw new Error(`Query vector must be an array of length ${VECTOR_DIM}`);
  }

  console.log(`Searching in '${collectionName}'...`);
  const results = await milvusClient.search({
    collection_name: collectionName,
    vector: queryVector,
    limit: limit,
    metric_type: INDEX_CONFIG.metric_type,
    params: { ef: 64 },
    output_fields: outputFields,
  });

  console.log(`Found ${results.results?.length || 0} results.`);
  return results;
}

/**
 * Get collection statistics
 * @param {string} collectionName - Name of the collection (defaults to COLLECTION_NAME)
 * @returns {Promise<Object>} Collection statistics
 */
export async function getCollectionStats(collectionName = COLLECTION_NAME) {
  const milvusClient = getClient();

  const stats = await milvusClient.getCollectionStatistics({
    collection_name: collectionName,
  });

  return stats;
}

/**
 * Close the Milvus client connection
 */
export async function closeConnection() {
  if (client) {
    await client.closeConnection();
    client = null;
    console.log('Milvus connection closed.');
  }
}

// Export configuration constants
export { COLLECTION_NAME, VECTOR_DIM, SCHEMA };
