import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let mcpClient = null;

export async function getMCPClient() {
  if (mcpClient) return mcpClient;

  // use/import a pre-defined mcp-server
  const transport = new StdioClientTransport({
    command: "node",
    args: [process.cwd() + "/mcp-servers/file-server.mjs"],
  });

  mcpClient = new Client(
    {
      name: "my-app",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await mcpClient.connect(transport);
  return mcpClient;
}

export async function getMCPTools() {
  const client = await getMCPClient();
  const { tools } = await client.listTools();

  // Convert MCP tool format to Anthropic tool format
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }));
}

export async function callMCPTool(name, args) {
  const client = await getMCPClient();
  return await client.callTool({ name, arguments: args });
}
