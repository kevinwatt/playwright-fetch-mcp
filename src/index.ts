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
    name: "zcaceres/fetch",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fetch_html",
        description: "從網站擷取並返回 HTML 內容",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "要擷取的網站 URL",
            },
            headers: {
              type: "object",
              description: "可選的請求標頭",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_markdown",
        description: "從網站擷取並返回 Markdown 格式內容",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "要擷取的網站 URL",
            },
            headers: {
              type: "object",
              description: "可選的請求標頭",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_txt",
        description: "從網站擷取並返回純文字內容（不含 HTML）",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "要擷取的網站 URL",
            },
            headers: {
              type: "object",
              description: "可選的請求標頭",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_json",
        description: "從 URL 擷取並返回 JSON 內容",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "要擷取的 JSON URL",
            },
            headers: {
              type: "object",
              description: "可選的請求標頭",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

const toolHandlers: { [key: string]: (payload: any) => Promise<any> } = {
  fetch_html: Fetcher.html,
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
  throw new Error("找不到對應的工具");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("main() 中發生嚴重錯誤:", error);
  process.exit(1);
});
