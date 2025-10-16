import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";


// Configure the allowed directory
const ALLOWED_DIR = path.resolve(
  process.env.LOCAL_FILE_PATH
);

const server = new Server(
  {
    name: "file-access-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List files tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_files",
        description: "List all files in the allowed directory",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "read_file",
        description: "Read the contents of a file from the allowed directory",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Name of the file to read",
            },
          },
          required: ["filename"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_files") {
      const files = await fs.readdir(ALLOWED_DIR);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(files, null, 2),
          },
        ],
      };
    }

    if (name === "read_file") {
      const filename = args.filename;
      const filepath = path.join(ALLOWED_DIR, filename);

      // Security check: ensure the resolved path is within allowed directory
      if (!filepath.startsWith(ALLOWED_DIR)) {
        throw new Error("Access denied: file is outside allowed directory");
      }

      const content = await fs.readFile(filepath, "utf-8");
      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("File access MCP server running");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
