import { NextResponse } from "next/server";
import {
  createCollection,
  ingestData,
  search,
  getCollectionStats,
  COLLECTION_NAME,
  VECTOR_DIM,
} from "@/lib/milvus-handler";

/**
 * POST endpoint for Milvus operations
 * Supports: search, ingest, createCollection
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action parameter is required" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "search":
        // Search for similar vectors
        // Required: queryVector (array of numbers with length VECTOR_DIM)
        // Optional: limit (default: 5), outputFields, collectionName
        if (!params.queryVector) {
          return NextResponse.json(
            { error: "queryVector is required for search action" },
            { status: 400 }
          );
        }

        if (!Array.isArray(params.queryVector)) {
          return NextResponse.json(
            { error: "queryVector must be an array" },
            { status: 400 }
          );
        }

        if (params.queryVector.length !== VECTOR_DIM) {
          return NextResponse.json(
            {
              error: `queryVector must have length ${VECTOR_DIM}, got ${params.queryVector.length}`,
            },
            { status: 400 }
          );
        }

        result = await search(
          params.queryVector,
          params.limit || 5,
          params.outputFields || ["fileID", "location", "page"],
          params.collectionName || COLLECTION_NAME
        );

        return NextResponse.json({
          success: true,
          action: "search",
          results: result.results || [],
          status: result.status,
        });

      case "ingest":
        // Ingest data into collection
        // Required: data (array of objects matching schema)
        // Optional: collectionName
        if (!params.data || !Array.isArray(params.data)) {
          return NextResponse.json(
            { error: "data array is required for ingest action" },
            { status: 400 }
          );
        }

        if (params.data.length === 0) {
          return NextResponse.json(
            { error: "data array cannot be empty" },
            { status: 400 }
          );
        }

        result = await ingestData(
          params.data,
          params.collectionName || COLLECTION_NAME
        );

        return NextResponse.json({
          success: true,
          action: "ingest",
          insertCount: result.insertCount,
          message: result.message,
        });

      case "createCollection":
        // Create a new collection
        // Optional: collectionName, dropIfExists (default: false)
        result = await createCollection(
          params.collectionName || COLLECTION_NAME,
          params.dropIfExists || false
        );

        return NextResponse.json({
          success: true,
          action: "createCollection",
          message: result.message,
        });

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Supported actions: search, ingest, createCollection`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in Milvus API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for Milvus status and collection information
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const collectionName = searchParams.get("collection") || COLLECTION_NAME;
    const action = searchParams.get("action") || "stats";

    if (action === "stats") {
      // Get collection statistics
      const stats = await getCollectionStats(collectionName);

      return NextResponse.json({
        success: true,
        collection: collectionName,
        stats: stats,
        vectorDimension: VECTOR_DIM,
      });
    } else if (action === "config") {
      // Return configuration information
      return NextResponse.json({
        success: true,
        config: {
          defaultCollection: COLLECTION_NAME,
          vectorDimension: VECTOR_DIM,
          supportedActions: ["search", "ingest", "createCollection"],
        },
      });
    } else {
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Supported actions: stats, config`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in Milvus GET API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
