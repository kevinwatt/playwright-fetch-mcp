import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { RequestPayload } from "./types.js";
import { DNList } from "./DNList.js";
import { chromium } from "playwright";

export class Fetcher {
  // 最大重試次數
  private static MAX_RETRIES = 2;
  // 基本超時時間（毫秒）
  private static BASE_TIMEOUT = 10000;
  // 最大重定向次數
  private static MAX_REDIRECTS = 3;

  private static async _fetch({
    url,
    headers,
  }: RequestPayload): Promise<{ content: string; contentType: string }> {
    // 檢查是否需要進行 DNList 檢查
    const dnListCheckEnv = process.env.DNListCheck || "Enable";
    const shouldCheckDNList = dnListCheckEnv.toLowerCase() !== "disable";
    
    if (shouldCheckDNList) {
      const allowed = await DNList.isAllowed(url);
      if (!allowed) {
        throw new Error("Not a EC site. Fetch Tools only crawler EC Site.");
      }
    }

    let lastError: Error | null = null;
    
    // 重試邏輯
    for (let attempt = 0; attempt <= Fetcher.MAX_RETRIES; attempt++) {
      try {
        // 啟動 Playwright 瀏覽器
        const browser = await chromium.launch({ 
          headless: true,
          // 增加啟動超時時間
          timeout: 30000
        });
        
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          extraHTTPHeaders: headers,
        });
        
        const page = await context.newPage();

        try {
          console.log(`嘗試第 ${attempt + 1} 次抓取 ${url}`);
          
          // 追蹤重定向次數
          let redirectCount = 0;
          
          // 設置路由處理程序來監控和限制重定向
          await page.route('**/*', async (route) => {
            const request = route.request();
            
            // 檢查是否為重定向請求
            if (request.isNavigationRequest() && request.redirectedFrom()) {
              redirectCount++;
              console.log(`重定向 #${redirectCount}: ${request.redirectedFrom()?.url()} -> ${request.url()}`);
              
              // 如果重定向次數超過限制，則中止請求
              if (redirectCount > Fetcher.MAX_REDIRECTS) {
                console.error(`重定向次數超過限制 (${Fetcher.MAX_REDIRECTS})，中止請求`);
                await route.abort('failed');
                return;
              }
            }
            
            // 繼續請求
            await route.continue();
          });
          
          // 使用最基本的導航方式，不等待任何特定事件
          const response = await page.goto(url, { 
            waitUntil: "commit", // 只等待開始接收頁面內容
            timeout: Fetcher.BASE_TIMEOUT * (attempt + 1)
          });
          
          if (!response) {
            throw new Error("No response received");
          }
          
          if (response.status() >= 400) {
            throw new Error(`HTTP error: ${response.status()}`);
          }
          
          // 等待一小段時間讓頁面內容加載
          await page.waitForTimeout(2000);
          
          // 獲取內容類型
          const contentType = response.headers()["content-type"] || "";
          
          // 獲取頁面內容
          const content = await page.content();
          
          // 成功獲取內容，返回結果
          return { content, contentType };
        } finally {
          // 確保瀏覽器關閉
          await browser.close();
        }
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.error(`第 ${attempt + 1} 次抓取失敗: ${lastError.message}`);
        
        // 如果不是最後一次嘗試，則等待一段時間後重試
        if (attempt < Fetcher.MAX_RETRIES) {
          const delay = 1000 * (attempt + 1); // 逐漸增加延遲時間
          console.log(`等待 ${delay}ms 後重試...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 所有重試都失敗了，拋出最後一個錯誤
    throw new Error(`Failed to fetch ${url} after ${Fetcher.MAX_RETRIES + 1} attempts: ${lastError?.message || "Unknown error"}`);
  }

  private static _handleError(error: unknown) {
    return {
      content: [{ type: "text", text: (error as Error).message }],
      isError: true,
    };
  }

  static async html(requestPayload: RequestPayload) {
    try {
      const { content } = await Fetcher._fetch(requestPayload);
      return { content: [{ type: "text", text: content }], isError: false };
    } catch (error) {
      return Fetcher._handleError(error);
    }
  }

  static async json(requestPayload: RequestPayload) {
    try {
      const { content, contentType } = await Fetcher._fetch(requestPayload);
      
      // 檢查內容類型是否為 JSON
      if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
        // 嘗試解析內容為 JSON
        try {
          const jsonObj = JSON.parse(content);
          return {
            content: [{ type: "text", text: JSON.stringify(jsonObj) }],
            isError: false,
          };
        } catch (parseError) {
          throw new Error("Response is not valid JSON");
        }
      } else {
        // 直接解析 JSON
        const jsonObj = JSON.parse(content);
        return {
          content: [{ type: "text", text: JSON.stringify(jsonObj) }],
          isError: false,
        };
      }
    } catch (error) {
      return Fetcher._handleError(error);
    }
  }

  static async txt(requestPayload: RequestPayload) {
    try {
      const { content } = await Fetcher._fetch(requestPayload);

      const dom = new JSDOM(content);
      const document = dom.window.document;

      const scripts = document.getElementsByTagName("script");
      const styles = document.getElementsByTagName("style");
      Array.from(scripts).forEach((script) => script.remove());
      Array.from(styles).forEach((style) => style.remove());

      const text = document.body.textContent || "";

      const normalizedText = text.replace(/\s+/g, " ").trim();

      return {
        content: [{ type: "text", text: normalizedText }],
        isError: false,
      };
    } catch (error) {
      return Fetcher._handleError(error);
    }
  }

  static async markdown(requestPayload: RequestPayload) {
    try {
      const { content } = await Fetcher._fetch(requestPayload);
      const turndownService = new TurndownService();
      const markdown = turndownService.turndown(content);
      return { content: [{ type: "text", text: markdown }], isError: false };
    } catch (error) {
      return Fetcher._handleError(error);
    }
  }
}
