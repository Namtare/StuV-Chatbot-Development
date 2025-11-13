import { pipeline } from '@xenova/transformers';

// Singleton pattern for the embedding model
let embeddingPipeline = null;

/**
 * Get or initialize the embedding pipeline
 * Uses the same model as Python: sentence-transformers/all-MiniLM-L6-v2
 * @returns {Promise<any>} The embedding pipeline
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('Initializing embedding model (all-MiniLM-L6-v2)...');
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
    console.log('Embedding model loaded successfully');
  }
  return embeddingPipeline;
}

/**
 * Generate embeddings for a text string
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} 384-dimensional embedding vector
 */
export async function generateEmbedding(text) {
  const pipeline = await getEmbeddingPipeline();

  // Generate embedding
  const output = await pipeline(text, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to array
  const embedding = Array.from(output.data);

  return embedding;
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} Array of 384-dimensional embedding vectors
 */
export async function generateEmbeddings(texts) {
  const pipeline = await getEmbeddingPipeline();

  const embeddings = await Promise.all(
    texts.map(async (text) => {
      const output = await pipeline(text, {
        pooling: 'mean',
        normalize: true,
      });
      return Array.from(output.data);
    })
  );

  return embeddings;
}
