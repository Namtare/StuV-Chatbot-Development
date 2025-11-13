import {
  createCollection,
  ingestData,
  getCollectionStats,
  VECTOR_DIM,
} from './milvus-handler.js';
/**
 * Initialization script that creates collection and ingests a test entity
 * This runs automatically when the Milvus Docker container starts
 */
async function initializeMilvus() {
  try {
    console.log('=== Milvus Initialization Started ===\n');

    // Create collection
    console.log('[1/3] Creating collections...');
    console.log("creating testing collecion (chunk data)")
    const createResult = await createCollection('test', true);

    if (!createResult.success) {
      throw new Error(`Collection 'chunk information' creation failed: ${createResult.message}`);
    }

    console.log(`✓ ${createResult.message}`);


    // create page-with-metadata collection
    console.log("creating  page-meta-information collection (page-summaries)")
    const createPageMeta = await createCollection("page_with_meta", true)
    if (!createPageMeta.success) {
      throw new Error(`Collection creation 'page_with_meta' creation failed: ${createPageMeta.message}`)
    }

    console.log(`✓ ${createPageMeta.message}`);

    // Create a test entity with a predictable vector
    // Using a simple pattern: first half is 0.5, second half is 0.8
    const testVector = [
      ...Array(VECTOR_DIM / 2).fill(0.5),
      ...Array(VECTOR_DIM / 2).fill(0.8),
    ];

    const testEntity = {
      chunk_id: 1,
      fileID: 'TEST_ENTITY_001',
      filename: 'test-document.pdf',
      file_hash: 'd41d8cd98f00b204e9800998ecf8427e', // MD5 hash example
      page: 1,
      chunk_index: 0,
      chunk_text: 'This is a test chunk of text from the test document.',
      summary: 'Test document summary for verification purposes.',
      location: 'https://drive.google.com/file/d/TEST_ENTITY_001/view',
      chunk: testVector,
    };

    console.log('\n[2/3] Ingesting test entity...');
    console.log('Test entity details:');
    console.log(`  - fileID: ${testEntity.fileID}`);
    console.log(`  - filename: ${testEntity.filename}`);
    console.log(`  - file_hash: ${testEntity.file_hash}`);
    console.log(`  - page: ${testEntity.page}`);
    console.log(`  - chunk_index: ${testEntity.chunk_index}`);
    console.log(`  - chunk_text: ${testEntity.chunk_text}`);
    console.log(`  - summary: ${testEntity.summary}`);
    console.log(`  - location: ${testEntity.location}`);
    console.log(`  - vector dimension: ${testVector.length}`);
    console.log(`  - vector pattern: first half=0.5, second half=0.8`);

    const ingestResult = await ingestData([testEntity], 'test');

    // Validate ingestion result
    if (!ingestResult.success) {
      throw new Error(`Data ingestion failed: ${ingestResult.message}`);
    }

    if (!ingestResult.insertCount || ingestResult.insertCount === 0) {
      throw new Error(
        `Data ingestion returned 0 entities. Expected 1 entity to be inserted. ` +
        `The insertion failed silently.`
      );
    }

    console.log(
      `✓ Successfully ingested ${ingestResult.insertCount} test entity`
    );


    // insert test entity for page-meta-information
    const testSummaryVector = [
      ...Array(VECTOR_DIM / 2).fill(0.3),
      ...Array(VECTOR_DIM / 2).fill(0.7),
    ];

    const testPageMeta = {
      page_id: "TEST_ENTITY_001_page_1",
      file_id: "TEST_ENTITY_001",
      local_page_num: 1,
      summary: "Sample summary!",
      summary_embedding: testSummaryVector
    }
    console.log("Test entity page-meta details: ")
    console.log(`  - page_id: ${testPageMeta.page_id}`);
    console.log(`  - file_id: ${testPageMeta.file_id}`);
    console.log(`  - local_page_num: ${testPageMeta.local_page_num}`);
    console.log(`  - summary: ${testPageMeta.summary}`);
    console.log(`  - summary_embedding dimension: ${testSummaryVector.length}`);

    const ingestPageMeta = await ingestData([testPageMeta], 'page_with_meta');
    
    // Validate ingestion result
    if (!ingestPageMeta.success) {
      throw new Error(`Data ingestion failed: ${ingestPageMeta.message}`);
    }

    if (!ingestPageMeta.insertCount || ingestPageMeta.insertCount === 0) {
      throw new Error(
        `Data ingestion returned 0 entities for page-meta. Expected 1 entity to be inserted. ` +
        `The insertion failed silently.`
      );
    }

    console.log(
      `✓ Successfully ingested ${ingestPageMeta.insertCount} test entity`
    );


    // Verify collection stats
    console.log('\n[3/3] Verifying collection...');
    const stats = await getCollectionStats('test');
    const rowCount = stats.data?.row_count;

    const stats_page_meta = await getCollectionStats("page_with_meta");
    const rowCountPageMeta = stats_page_meta.data?.row_count;

    console.log('Collection statistics:');
    console.log(`  - Row count chunks: ${rowCount || 'N/A'}`);
    console.log(`  - Row count pages: ${rowCountPageMeta || 'N/A'}`);
    // Verify the row count matches
    if (rowCount === undefined || rowCount === null) {
      throw new Error('Unable to retrieve collection chunks row count');
    }
    if (rowCountPageMeta === undefined || rowCountPageMeta === null){
      throw new Error("Unable to retrieve collection pages row count");
    }

    if (rowCount === 0) {
      throw new Error(
        'Collection chunks has 0 rows after ingestion. Data was not persisted correctly.'
      );
    }
    if (rowCountPageMeta === 0){
      throw new Error(
        'Collection pages has 0 rows after ingestion. Data was not persisted correctly.'
      )
    }

    console.log(`✓ Verified: Collection chunks contains ${rowCount} entity (as expected)`);
    console.log(`✓ Verified: Collection chunks contains ${rowCountPageMeta} entity (as expected)`);
    console.log('\n=== Milvus Initialization Completed Successfully ===');
    console.log('✓ Test entities are ready for querying');
    console.log(
      '✓ Run "docker exec milvus-standalone node /app/test-query.js" to verify the chunk entity..\n'
    );

    process.exit(0);
  } catch (error) {
    console.error('\n✗ ERROR: Milvus initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run initialization
initializeMilvus();
