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
  // 檢查 fetch_html 工具是否啟用
  const fetchHtmlEnv = process.env.fetch_html || "Disable";
  const isFetchHtmlEnabled = fetchHtmlEnv.toLowerCase() === "enable";
  
  // 準備工具列表
  const tools = [];
  
  // 根據環境變量決定是否添加 fetch_html 工具
  if (isFetchHtmlEnabled) {
    tools.push({
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
    });
  }
  
  // 添加其他工具（這些工具始終啟用）
  tools.push(
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
    }
  );
  
  return { tools };
});

const toolHandlers: { [key: string]: (payload: any) => Promise<any> } = {
  fetch_html: Fetcher.html,
  fetch_json: Fetcher.json,
  fetch_txt: Fetcher.txt,
  fetch_markdown: Fetcher.markdown,
};

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // 檢查 fetch_html 工具是否啟用
  if (name === "fetch_html") {
    const fetchHtmlEnv = process.env.fetch_html || "Disable";
    const isFetchHtmlEnabled = fetchHtmlEnv.toLowerCase() === "enable";
    
    if (!isFetchHtmlEnabled) {
      throw new Error("fetch_html 工具已禁用。請在環境變量中設置 fetch_html=Enable 以啟用此工具。");
    }
  }
  
  const validatedArgs = RequestPayloadSchema.parse(args);
  const handler = toolHandlers[name];
  if (handler) {
    return handler(validatedArgs);
  }
  throw new Error("找不到對應的工具");
});

async function main() {
  // 輸出環境變量設置信息
  console.log("環境變量設置:");
  console.log(`- fetch_html: ${process.env.fetch_html || "Disable"} (預設: Disable)`);
  console.log(`- DNListCheck: ${process.env.DNListCheck || "Enable"} (預設: Enable)`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("main() 中發生嚴重錯誤:", error);
  process.exit(1);
});
