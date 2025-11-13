import { search, CHUNKS_COLLECTION_NAME, PAGES_COLLECTION_NAME } from './milvus-handler.js';
import { generateEmbedding } from './embeddings.js';

/**
 * Orchestrates a RAG-based conversation using Milvus vector search.
 *
 * @param {Array} messages - Array of conversation messages [{role: 'user'|'assistant', content: string}]
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Number of results to return (default: 5)
 * @param {string} options.collection - Collection to search: 'chunks' or 'pages' (default: 'chunks')
 * @param {boolean} options.includeScores - Include similarity scores in output (default: true)
 * @returns {Object} Response with content, messages, and usage stats
 */
export async function orchestrateMilvusSearch(messages, options = {}) {
  const limit = options.limit || 5;
  const collectionType = options.collection || 'chunks';
  const includeScores = options.includeScores !== false;

  // Extract the last user message as the query
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();

  if (!lastUserMessage || !lastUserMessage.content) {
    return {
      content: 'No query provided.',
      messages: [...messages, { role: 'assistant', content: 'No query provided.' }],
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    };
  }

  const query = lastUserMessage.content;
  console.log(`Milvus RAG: Searching for "${query}" in ${collectionType} collection (limit: ${limit})`);

  try {
    // Step 1: Generate embedding for the query
    console.log('Generating embedding for query...');
    const queryEmbedding = await generateEmbedding(query);
    console.log(`Embedding generated (${queryEmbedding.length} dimensions)`);

    // Step 2: Determine collection and output fields
    const collectionName = collectionType === 'pages'
      ? PAGES_COLLECTION_NAME
      : CHUNKS_COLLECTION_NAME;

    const outputFields = collectionType === 'pages'
      ? ['page_id', 'file_id', 'local_page_num', 'summary']
      : ['fileID', 'filename', 'page', 'chunk_index', 'chunk_text', 'summary', 'location'];

    // Step 3: Search Milvus
    console.log(`Searching in ${collectionName}...`);
    const searchResults = await search(
      queryEmbedding,
      collectionName,
      limit,
      outputFields
    );

    console.log(`Found ${searchResults.results?.length || 0} results`);

    // Step 4: Format results as readable text
    const content = formatResults(searchResults.results || [], collectionType, includeScores);

    // Step 5: Return in the same format as LLM orchestration
    const assistantMessage = { role: 'assistant', content };

    return {
      content,
      messages: [...messages, assistantMessage],
      model: `milvus-${collectionType}`,
      usage: {
        prompt_tokens: query.length,  // Approximate
        completion_tokens: content.length  // Approximate
      }
    };

  } catch (error) {
    console.error('Milvus search error:', error);

    const errorMessage = `Error searching Milvus: ${error.message}`;
    const assistantMessage = { role: 'assistant', content: errorMessage };

    return {
      content: errorMessage,
      messages: [...messages, assistantMessage],
      model: 'milvus-error',
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    };
  }
}

/**
 * Format search results into readable text
 * @param {Array} results - Search results from Milvus
 * @param {string} collectionType - 'chunks' or 'pages'
 * @param {boolean} includeScores - Whether to include similarity scores
 * @returns {string} Formatted results as text
 */
function formatResults(results, collectionType, includeScores) {
  if (!results || results.length === 0) {
    return 'No relevant documents found in the knowledge base.';
  }

  if (collectionType === 'pages') {
    // Format page summaries
    return results
      .map((result, index) => {
        const score = includeScores ? ` (Similarity: ${(result.score * 100).toFixed(1)}%)` : '';
        return `[Result ${index + 1}]${score}
File: ${result.file_id}
Page: ${result.local_page_num}
Summary:
${result.summary}

---`;
      })
      .join('\n\n');
  } else {
    // Format chunk results
    return results
      .map((result, index) => {
        const score = includeScores ? ` (Similarity: ${(result.score * 100).toFixed(1)}%)` : '';
        return `[Result ${index + 1}]${score}
Source: ${result.filename} (Page ${result.page})
Location: ${result.location || 'N/A'}

Content:
${result.chunk_text}

---`;
      })
      .join('\n\n');
  }
}

/**
 * Hybrid search: Search pages first, then chunks from relevant pages
 * More advanced RAG pattern for better results
 *
 * @param {Array} messages - Array of conversation messages
 * @param {Object} options - Configuration options
 * @returns {Object} Response with combined page and chunk results
 */
export async function orchestrateMilvusHybridSearch(messages, options = {}) {
  const pageLimitOption = options.pageLimit || 2;
  const chunkLimitOption = options.chunkLimit || 5;

  // Extract the last user message as the query
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();

  if (!lastUserMessage || !lastUserMessage.content) {
    return {
      content: 'No query provided.',
      messages: [...messages, { role: 'assistant', content: 'No query provided.' }],
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    };
  }

  const query = lastUserMessage.content;
  console.log(`Milvus Hybrid RAG: Searching for "${query}"`);

  try {
    // Generate embedding once
    const queryEmbedding = await generateEmbedding(query);

    // Step 1: Search pages for high-level context
    console.log('Step 1: Searching pages collection...');
    const pageResults = await search(
      queryEmbedding,
      PAGES_COLLECTION_NAME,
      pageLimitOption,
      ['page_id', 'file_id', 'local_page_num', 'summary']
    );

    // Step 2: Search chunks for detailed content
    console.log('Step 2: Searching chunks collection...');
    const chunkResults = await search(
      queryEmbedding,
      CHUNKS_COLLECTION_NAME,
      chunkLimitOption,
      ['fileID', 'filename', 'page', 'chunk_index', 'chunk_text', 'location']
    );

    // Step 3: Format combined results
    const content = `📄 RELEVANT PAGES:

${formatResults(pageResults.results || [], 'pages', true)}

📝 DETAILED CONTENT:

${formatResults(chunkResults.results || [], 'chunks', true)}`;

    const assistantMessage = { role: 'assistant', content };

    return {
      content,
      messages: [...messages, assistantMessage],
      model: 'milvus-hybrid',
      usage: {
        prompt_tokens: query.length,
        completion_tokens: content.length
      }
    };

  } catch (error) {
    console.error('Milvus hybrid search error:', error);

    const errorMessage = `Error in hybrid search: ${error.message}`;
    const assistantMessage = { role: 'assistant', content: errorMessage };

    return {
      content: errorMessage,
      messages: [...messages, assistantMessage],
      model: 'milvus-error',
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    };
  }
}
