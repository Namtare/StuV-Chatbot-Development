import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let mcpClient = null;

export async function getGDriveMCPClient() {
  if (mcpClient) return mcpClient;

  // Connect to Google Drive MCP server
  const transport = new StdioClientTransport({
    command: "node",
    args: [process.cwd() + "/mcp-servers/google-drive-server.mjs"],
  });

  mcpClient = new Client(
    {
      name: "my-app-gdrive",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await mcpClient.connect(transport);
  return mcpClient;
}

export async function getGDriveMCPTools() {
  const client = await getGDriveMCPClient();
  const { tools } = await client.listTools();

  // Convert MCP tool format to Anthropic tool format
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }));
}

export async function callGDriveMCPTool(name, args) {
  const client = await getGDriveMCPClient();
  return await client.callTool({ name, arguments: args });
}
