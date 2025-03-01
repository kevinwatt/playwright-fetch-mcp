import { Fetcher } from "./Fetcher";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { DNList } from "./DNList.js";

global.fetch = jest.fn();

jest.mock("jsdom");

jest.mock("turndown");

describe("Fetcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 預設讓 DNList.isAllowed 為 true
    jest.spyOn(DNList, "isAllowed").mockResolvedValue(true);
  });

  const mockRequest = {
    url: "https://example.com",
    headers: { "Custom-Header": "Value" },
  };

  const mockHtml = `
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
  `;

  describe("DNList 檢查", () => {
    it("應拒絕非 EC 網站", async () => {
      // 模擬 DNList 回傳 false
      jest.spyOn(DNList, "isAllowed").mockResolvedValueOnce(false);
      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Not a EC site. Fetch Tools only crawler EC Site." }],
        isError: true,
      });
    });
  });

  describe("html", () => {
    it("應返回原始 HTML 內容", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      });

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: mockHtml }],
        isError: false,
      });
    });

    it("應處理錯誤", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com: Network error" }],
        isError: true,
      });
    });
  });

  describe("json", () => {
    it("應解析並返回 JSON 內容", async () => {
      const mockJson = { key: "value" };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      const result = await Fetcher.json(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: JSON.stringify(mockJson) }],
        isError: false,
      });
    });

    it("應處理錯誤", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Invalid JSON"));

      const result = await Fetcher.json(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com: Invalid JSON" }],
        isError: true,
      });
    });
  });

  describe("txt", () => {
    it("應返回不含 HTML 標籤、腳本與樣式的純文字內容", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      });

      const mockTextContent = "Hello World This is a test paragraph.";
      // @ts-expect-error Mocking JSDOM
      (JSDOM as jest.Mock).mockImplementationOnce(() => ({
        window: {
          document: {
            body: {
              textContent: mockTextContent,
            },
            getElementsByTagName: jest.fn().mockReturnValue([]),
          },
        },
      }));

      const result = await Fetcher.txt(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: mockTextContent }],
        isError: false,
      });
    });

    it("應處理錯誤", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Parsing error"));

      const result = await Fetcher.txt(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com: Parsing error" }],
        isError: true,
      });
    });
  });

  describe("markdown", () => {
    it("應將 HTML 轉換為 Markdown", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      });

      const mockMarkdown = "# Hello World\n\nThis is a test paragraph.";
      (TurndownService as jest.Mock).mockImplementationOnce(() => ({
        turndown: jest.fn().mockReturnValueOnce(mockMarkdown),
      }));

      const result = await Fetcher.markdown(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: mockMarkdown }],
        isError: false,
      });
    });

    it("應處理錯誤", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Conversion error"));

      const result = await Fetcher.markdown(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com: Conversion error" }],
        isError: true,
      });
    });
  });

  describe("error handling", () => {
    it("應處理非正常回應", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com: HTTP error: 404" }],
        isError: true,
      });
    });

    it("應處理未知錯誤", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce("Unknown error");

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [{ type: "text", text: "Failed to fetch https://example.com: Unknown error" }],
        isError: true,
      });
    });
  });
});
