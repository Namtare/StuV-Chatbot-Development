import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getDriveClient } from "../src/lib/google-drive-auth.js";

// Initialize Drive client
let drive = null;

function initializeDrive() {
  try {
    drive = getDriveClient();
    console.error("Successfully loaded Google Drive credentials");
  } catch (error) {
    console.error(
      "Warning: Failed to initialize Google Drive:",
      error.message
    );
    console.error(
      "Please authenticate via http://localhost:3000/api/auth/authorize"
    );
  }
}

const server = new Server(
  {
    name: "google-drive-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_drive_files",
        description:
          "List files in Google Drive. Optionally filter by folder ID, search query, or file type.",
        inputSchema: {
          type: "object",
          properties: {
            folderId: {
              type: "string",
              description:
                "Optional folder ID to list files from. If not provided, lists files from 'My Drive' root.",
            },
            query: {
              type: "string",
              description:
                "Optional search query (e.g., 'name contains \"report\"' or 'mimeType=\"application/pdf\"')",
            },
            pageSize: {
              type: "number",
              description: "Number of files to return (default: 100, max: 1000)",
              default: 100,
            },
          },
        },
      },
      {
        name: "get_file_metadata",
        description:
          "Get detailed metadata for a specific file by its ID, including name, size, modified time, and MIME type.",
        inputSchema: {
          type: "object",
          properties: {
            fileId: {
              type: "string",
              description: "The Google Drive file ID",
            },
          },
          required: ["fileId"],
        },
      },
      {
        name: "read_file_content",
        description:
          "Read the content of a file from Google Drive. Works with text files, Google Docs, Sheets, and other exportable formats.",
        inputSchema: {
          type: "object",
          properties: {
            fileId: {
              type: "string",
              description: "The Google Drive file ID",
            },
            mimeType: {
              type: "string",
              description:
                'Optional MIME type for export (for Google Workspace files). E.g., "text/plain" for Docs, "text/csv" for Sheets.',
            },
          },
          required: ["fileId"],
        },
      },
      {
        name: "search_files",
        description:
          "Search for files in Google Drive using advanced search queries.",
        inputSchema: {
          type: "object",
          properties: {
            searchTerm: {
              type: "string",
              description:
                "The search term (will search in file names and content)",
            },
            pageSize: {
              type: "number",
              description: "Number of results to return (default: 20, max: 100)",
              default: 20,
            },
          },
          required: ["searchTerm"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!drive) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Google Drive not initialized. Please ensure you have authenticated via http://localhost:3000/api/auth/authorize",
        },
      ],
      isError: true,
    };
  }

  try {
    if (name === "list_drive_files") {
      const pageSize = Math.min(args.pageSize || 100, 1000);
      let query = args.query || "";

      // If folderId is provided, add it to the query
      if (args.folderId) {
        query = query
          ? `'${args.folderId}' in parents and ${query}`
          : `'${args.folderId}' in parents`;
      }

      const response = await drive.files.list({
        pageSize,
        fields:
          "files(id, name, mimeType, size, modifiedTime, webViewLink, parents)",
        q: query || undefined,
        orderBy: "modifiedTime desc",
      });

      const files = response.data.files;
      if (!files || files.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No files found.",
            },
          ],
        };
      }

      const fileList = files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? `${(file.size / 1024).toFixed(2)} KB` : "N/A",
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        parents: file.parents,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fileList, null, 2),
          },
        ],
      };
    }

    if (name === "get_file_metadata") {
      const fileId = args.fileId;

      const response = await drive.files.get({
        fileId,
        fields:
          "id, name, mimeType, size, modifiedTime, createdTime, description, webViewLink, owners, parents, shared, capabilities",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    }

    if (name === "read_file_content") {
      const fileId = args.fileId;

      // First, get file metadata to determine if it's a Google Workspace file
      const metadata = await drive.files.get({
        fileId,
        fields: "mimeType, name",
      });

      const mimeType = metadata.data.mimeType;
      let content;

      // Check if it's a Google Workspace file that needs export
      if (mimeType.startsWith("application/vnd.google-apps.")) {
        // Determine export MIME type
        let exportMimeType = args.mimeType;
        if (!exportMimeType) {
          // Default export types for common Google Workspace files
          if (mimeType === "application/vnd.google-apps.document") {
            exportMimeType = "text/plain";
          } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
            exportMimeType = "text/csv";
          } else if (mimeType === "application/vnd.google-apps.presentation") {
            exportMimeType = "text/plain";
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Cannot export file type ${mimeType}. Please specify a valid export mimeType.`,
                },
              ],
              isError: true,
            };
          }
        }

        const response = await drive.files.export(
          { fileId, mimeType: exportMimeType },
          { responseType: "text" }
        );
        content = response.data;
      } else {
        // Regular file download
        const response = await drive.files.get(
          { fileId, alt: "media" },
          { responseType: "text" }
        );
        content = response.data;
      }

      return {
        content: [
          {
            type: "text",
            text: `File: ${metadata.data.name}\nMIME Type: ${mimeType}\n\nContent:\n${content}`,
          },
        ],
      };
    }

    if (name === "search_files") {
      const searchTerm = args.searchTerm;
      const pageSize = Math.min(args.pageSize || 20, 100);

      // Build search query - searches in name and full text
      const query = `fullText contains '${searchTerm}' or name contains '${searchTerm}'`;

      const response = await drive.files.list({
        pageSize,
        q: query,
        fields:
          "files(id, name, mimeType, size, modifiedTime, webViewLink, parents)",
        orderBy: "modifiedTime desc",
      });

      const files = response.data.files;
      if (!files || files.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No files found matching "${searchTerm}".`,
            },
          ],
        };
      }

      const fileList = files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? `${(file.size / 1024).toFixed(2)} KB` : "N/A",
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
      }));

      return {
        content: [
          {
            type: "text",
            text: `Found ${files.length} file(s) matching "${searchTerm}":\n\n${JSON.stringify(fileList, null, 2)}`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  initializeDrive();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Drive MCP server running");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
