// write the fill, retrieve and config command as functions!
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

const address = 'localhost:19530';
const username = 'minioadmin';
const password = 'minioadmin';
const ssl = false; // secure or not

// connect to milvus
const client = new MilvusClient({ address, ssl, username, password });

// define schema
const collection_name = `first_collection`;
const dim = 128;

// Check if collection exists and drop it
const hasCollection = await client.hasCollection({
  collection_name: collection_name,
});

if (hasCollection.value) {
  console.log('Collection exists, dropping it...');
  await client.dropCollection({
    collection_name: collection_name,
  });
}

const schema = [
  {
    name: 'chunk_id',
    data_type: DataType.Int64,
    is_primary_key: true,
    auto_id: false,
  },
  { name: 'page', data_type: DataType.Int32 },
  { name: 'fileID', data_type: DataType.VarChar, max_length: 100 },
  { name: 'location', data_type: DataType.VarChar, max_length: 255 },
  { name: 'chunk', data_type: DataType.FloatVector, dim: dim },
];

// create collection
console.log('Creating collection...');
await client.createCollection({
  collection_name: collection_name,
  description: `my first collection`,
  fields: schema,
});

// create index on vector field
console.log('Creating index...');
await client.createIndex({
  collection_name: collection_name,
  field_name: 'chunk',
  index_type: 'HNSW',
  metric_type: 'COSINE',
  params: {
    M: 16,
    efConstruction: 200,
  },
});

// example data (will be replaced by a script that actually loads pdf and handles the ingestion)
let fields_data = [];
const r = {
  chunk_id: 1,
  page: 1,
  fileID: 'dhflv8276iuhncr',
  location: 'drive/protocols/',
  chunk: [...Array(dim)].map(() => Math.random()),
};
fields_data.push(r);

// insert data
console.log('Inserting data...');
const insertRes = await client.insert({
  collection_name: collection_name,
  data: fields_data,
});
console.log('Insert result:', insertRes);

// Flush to ensure data is persisted
console.log('Flushing data...');
await client.flush({
  collection_names: [collection_name],
});

// NOW load collection into memory (AFTER inserting data)
console.log('Loading collection...');
await client.loadCollection({
  collection_name: collection_name,
});

// Wait a moment for the collection to be fully loaded
await new Promise((resolve) => setTimeout(resolve, 1000));

// Check collection stats
const stats = await client.getCollectionStatistics({
  collection_name: collection_name,
});
console.log('Collection stats:', stats);

// Generate a random search vector
const searchVector = [...Array(dim)].map(() => Math.random());

// Perform a vector search on the collection
console.log('Searching...');
const res = await client.search({
  collection_name,
  vector: searchVector,
  limit: 1,
  metric_type: 'COSINE',
  params: { ef: 64 },
  output_fields: ['fileID', 'location', 'page'],
});

console.log('Search results:', JSON.stringify(res, null, 2));
