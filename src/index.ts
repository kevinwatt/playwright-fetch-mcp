#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestPayloadSchema } from "./types.js";
import { Fetcher } from "./Fetcher.js";

const server = new Server(
  {
    name: "@kevinwatt/playwright-fetch-mcp",
    version: "1.0.8",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Prepare tool list
  const tools = [];
  
  // Add tools
  tools.push(
    {
      name: "fetch_markdown",
      description: "Fetch content from a website and convert it to Markdown format",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL of the website to fetch",
          },
          headers: {
            type: "object",
            description: "Optional request headers",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "fetch_txt",
      description: "Fetch and return plain text content from a website (HTML tags removed)",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL of the website to fetch",
          },
          headers: {
            type: "object",
            description: "Optional request headers",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "fetch_json",
      description: "Fetch and return JSON content from a URL",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL of the JSON resource to fetch",
          },
          headers: {
            type: "object",
            description: "Optional request headers",
          },
        },
        required: ["url"],
      },
    }
  );
  
  return { tools };
});

const toolHandlers: { [key: string]: (payload: any) => Promise<any> } = {
  fetch_json: Fetcher.json,
  fetch_txt: Fetcher.txt,
  fetch_markdown: Fetcher.markdown,
};

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const validatedArgs = RequestPayloadSchema.parse(args);
  const handler = toolHandlers[name];
  if (handler) {
    return handler(validatedArgs);
  }
  throw new Error("Tool not found");
});

async function main() {
  // Output environment variable settings information
  console.log("Environment variables settings:");
  console.log(`- DNListCheck: ${process.env.DNListCheck || "Disable"} (default: Disable)`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Critical error in main():", error);
  process.exit(1);
});
