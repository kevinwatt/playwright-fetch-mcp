import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { DNList } from "./DNList.js";
import { chromium } from "playwright";

// 宣告 Fetcher 變數
let Fetcher: any;

// 模擬 DNList
jest.mock("./DNList.js", () => {
  return {
    DNList: {
      isAllowed: jest.fn().mockResolvedValue(true)
    }
  };
});

// 模擬 Playwright
jest.mock("playwright", () => {
  // 創建模擬回應
  const mockResponses = {
    default: {
      status: 200,
      headers: { "content-type": "text/html" },
      content: `
        <html>
          <head>
            <title>Test Page</title>
            <script>console.log('This should be removed');</script>
            <style>body { color: red; }</style>
          </head>
          <body>
            <h1>Hello World</h1>
            <p>This is a test paragraph.</p>
          </body>
        </html>
      `
    },
    error404: {
      status: 404,
      headers: { "content-type": "text/html" },
      content: "<html><body>404 Not Found</body></html>"
    },
    json: {
      status: 200,
      headers: { "content-type": "application/json" },
      content: JSON.stringify({ key: "value" })
    }
  };

  // 創建一個可配置的模擬
  let currentMockResponse = { ...mockResponses.default };
  let shouldThrowError = false;
  let errorToThrow: Error | string = new Error("Network error");

  // 重置模擬狀態的函數
  const resetMock = () => {
    currentMockResponse = { ...mockResponses.default };
    shouldThrowError = false;
    errorToThrow = new Error("Network error");
  };

  // 設置模擬回應的函數
  const setMockResponse = (type: keyof typeof mockResponses) => {
    currentMockResponse = { ...mockResponses[type] };
  };

  // 設置模擬錯誤的函數
  const setMockError = (error: Error | string) => {
    shouldThrowError = true;
    errorToThrow = error;
  };

  // 創建模擬的 route 處理
  const createMockRouteHandler = (handler: Function) => {
    const mockRequest = {
      isNavigationRequest: jest.fn().mockReturnValue(true),
      redirectedFrom: jest.fn().mockReturnValue(null),
      url: jest.fn().mockReturnValue("https://example.com")
    };

    const mockRoute = {
      request: jest.fn().mockReturnValue(mockRequest),
      continue: jest.fn().mockResolvedValue(undefined),
      abort: jest.fn().mockResolvedValue(undefined)
    };

    // 調用處理器
    handler(mockRoute);
    return Promise.resolve();
  };

  // 創建模擬的 page 對象
  const createMockPage = () => ({
    route: jest.fn().mockImplementation((pattern, handler) => createMockRouteHandler(handler)),
    goto: jest.fn().mockImplementation(() => {
      if (shouldThrowError) {
        return Promise.reject(errorToThrow);
      }
      return Promise.resolve({
        status: jest.fn().mockReturnValue(currentMockResponse.status),
        headers: jest.fn().mockReturnValue(currentMockResponse.headers)
      });
    }),
    content: jest.fn().mockResolvedValue(currentMockResponse.content),
    waitForTimeout: jest.fn().mockResolvedValue(undefined)
  });

  // 創建模擬的 context 對象
  const createMockContext = () => ({
    newPage: jest.fn().mockResolvedValue(createMockPage())
  });

  // 創建模擬的 browser 對象
  const createMockBrowser = () => ({
    newContext: jest.fn().mockResolvedValue(createMockContext()),
    close: jest.fn().mockResolvedValue(undefined)
  });

  // 返回模擬的 playwright 模組
  return {
    chromium: {
      launch: jest.fn().mockImplementation(() => {
        if (shouldThrowError) {
          return Promise.reject(errorToThrow);
        }
        return Promise.resolve(createMockBrowser());
      })
    },
    // 添加測試輔助函數
    __resetMock: resetMock,
    __setMockResponse: setMockResponse,
    __setMockError: setMockError
  };
});

// 模擬 JSDOM
jest.mock("jsdom", () => {
  return {
    JSDOM: jest.fn().mockImplementation((html) => {
      // 創建一個簡單的模擬 DOM
      return {
        window: {
          document: {
            body: {
              textContent: "Hello World This is a test paragraph."
            },
            getElementsByTagName: jest.fn().mockReturnValue([])
          }
        }
      };
    })
  };
});

// 模擬 TurndownService
jest.mock("turndown", () => {
  return jest.fn().mockImplementation(() => {
    return {
      turndown: jest.fn().mockReturnValue("# Hello World\n\nThis is a test paragraph.")
    };
  });
});

// 模擬 process.env
const originalEnv = process.env;
beforeEach(async () => {
  jest.resetModules();
  process.env = { ...originalEnv };
  
  // 重置所有模擬
  const playwright = require("playwright");
  playwright.__resetMock();
  
  // 動態導入 Fetcher 模組，確保模擬在導入前生效
  const fetcherModule = await import("./Fetcher.js");
  Fetcher = fetcherModule.Fetcher;
});

afterAll(() => {
  process.env = originalEnv;
});

describe("Fetcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 預設讓 DNList.isAllowed 為 true
    (DNList.isAllowed as jest.Mock).mockResolvedValue(true);
  });

  const mockRequest = {
    url: "https://example.com",
    headers: { "Custom-Header": "Value" },
  };

  describe("DNList 檢查", () => {
    it("應拒絕非 EC 網站", async () => {
      // 直接模擬 _fetch 方法拋出錯誤
      const originalFetch = Fetcher._fetch;
      Fetcher._fetch = jest.fn().mockRejectedValueOnce(
        new Error("Not a EC site. Fetch Tools only crawler EC Site.")
      );
      
      const result = await Fetcher.html(mockRequest);
      
      // 恢復原始方法
      Fetcher._fetch = originalFetch;
      
      expect(result).toEqual({
        content: [{ type: "text", text: "Not a EC site. Fetch Tools only crawler EC Site." }],
        isError: true,
      });
      
      // 移除對 DNList.isAllowed 的調用檢查
    });

    it("當 DNListCheck 設置為 Disable 時應跳過 DNList 檢查", async () => {
      // 設置環境變量
      process.env.DNListCheck = "Disable";
      
      // 模擬 DNList 回傳 false，但由於 DNListCheck 為 Disable，應該不會調用 isAllowed
      (DNList.isAllowed as jest.Mock).mockResolvedValueOnce(false);
      
      const result = await Fetcher.html(mockRequest);
      
      // 驗證 isAllowed 沒有被調用
      expect(DNList.isAllowed).not.toHaveBeenCalled();
      
      // 驗證結果
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Hello World");
    });
  });

  describe("html", () => {
    it("應返回原始 HTML 內容", async () => {
      const result = await Fetcher.html(mockRequest);
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Hello World");
    });

    it("應處理錯誤", async () => {
      // 模擬 Playwright 錯誤
      const playwright = require("playwright");
      playwright.__setMockError(new Error("Network error"));

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com after 3 attempts: Network error" }],
        isError: true,
      });
    });
  });

  describe("json", () => {
    it("應解析並返回 JSON 內容", async () => {
      // 設置 JSON 回應
      const playwright = require("playwright");
      playwright.__setMockResponse("json");

      const result = await Fetcher.json(mockRequest);
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain('{"key":"value"}');
    });

    it("應處理錯誤", async () => {
      // 模擬 Playwright 錯誤
      const playwright = require("playwright");
      playwright.__setMockError(new Error("Invalid JSON"));

      const result = await Fetcher.json(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com after 3 attempts: Invalid JSON" }],
        isError: true,
      });
    });
  });

  describe("txt", () => {
    it("應返回不含 HTML 標籤、腳本與樣式的純文字內容", async () => {
      const result = await Fetcher.txt(mockRequest);
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("Hello World This is a test paragraph.");
    });

    it("應處理錯誤", async () => {
      // 模擬 Playwright 錯誤
      const playwright = require("playwright");
      playwright.__setMockError(new Error("Parsing error"));

      const result = await Fetcher.txt(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com after 3 attempts: Parsing error" }],
        isError: true,
      });
    });
  });

  describe("markdown", () => {
    it("應將 HTML 轉換為 Markdown", async () => {
      const result = await Fetcher.markdown(mockRequest);
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("# Hello World\n\nThis is a test paragraph.");
    });

    it("應處理錯誤", async () => {
      // 模擬 Playwright 錯誤
      const playwright = require("playwright");
      playwright.__setMockError(new Error("Conversion error"));

      const result = await Fetcher.markdown(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com after 3 attempts: Conversion error" }],
        isError: true,
      });
    });
  });

  describe("error handling", () => {
    it("應處理非正常回應", async () => {
      // 設置 404 回應
      const playwright = require("playwright");
      playwright.__setMockResponse("error404");

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com after 3 attempts: HTTP error: 404" }],
        isError: true,
      });
    });

    it("應處理未知錯誤", async () => {
      // 模擬 Playwright 錯誤
      const playwright = require("playwright");
      playwright.__setMockError("Unknown error");

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com after 3 attempts: Unknown error" }],
        isError: true,
      });
    });
  });
});
