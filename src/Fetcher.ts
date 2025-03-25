import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { RequestPayload } from "./types.js";
import { DNList } from "./DNList.js";
import { chromium } from "playwright";
import { Readability } from "@mozilla/readability";

export class Fetcher {
  // Maximum retry count
  private static MAX_RETRIES = 2;
  // Base timeout (ms)
  private static BASE_TIMEOUT = 10000;
  // Maximum redirect count
  private static MAX_REDIRECTS = 3;

  private static async _fetch({
    url,
    headers,
  }: RequestPayload): Promise<{ content: string; contentType: string }> {
    // Check if DNList check is needed
    const dnListCheckEnv = process.env.DNListCheck || "Disable";
    const shouldCheckDNList = dnListCheckEnv.toLowerCase() !== "disable";
    
    if (shouldCheckDNList) {
      const allowed = await DNList.isAllowed(url);
      if (!allowed) {
        throw new Error("Not an EC site. Fetch Tools only crawl EC Sites.");
      }
    }

    let lastError: Error | null = null;
    
    // Retry logic
    for (let attempt = 0; attempt <= Fetcher.MAX_RETRIES; attempt++) {
      try {
        // Launch Playwright browser
        const browser = await chromium.launch({ 
          headless: true,
          // Increase launch timeout
          timeout: 30000
        });
        
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          extraHTTPHeaders: headers,
        });
        
        const page = await context.newPage();

        try {
          console.log(`Attempt ${attempt + 1} to fetch ${url}`);
          
          // Track redirect count
          let redirectCount = 0;
          
          // Set up route handler to monitor and limit redirects
          await page.route('**/*', async (route) => {
            const request = route.request();
            
            // Check if it's a redirect request
            if (request.isNavigationRequest() && request.redirectedFrom()) {
              redirectCount++;
              console.log(`Redirect #${redirectCount}: ${request.redirectedFrom()?.url()} -> ${request.url()}`);
              
              // If redirect count exceeds limit, abort the request
              if (redirectCount > Fetcher.MAX_REDIRECTS) {
                console.error(`Redirect count exceeded limit (${Fetcher.MAX_REDIRECTS}), aborting request`);
                await route.abort('failed');
                return;
              }
            }
            
            // Continue with the request
            await route.continue();
          });
          
          // Use basic navigation, don't wait for any specific event
          const response = await page.goto(url, { 
            waitUntil: "commit", // Only wait for page content to start loading
            timeout: Fetcher.BASE_TIMEOUT * (attempt + 1)
          });
          
          if (!response) {
            throw new Error("No response received");
          }
          
          if (response.status() >= 400) {
            throw new Error(`HTTP error: ${response.status()}`);
          }
          
          // Wait a short time for page content to load
          await page.waitForTimeout(2000);
          
          // Get content type
          const contentType = response.headers()["content-type"] || "";
          
          // Get page content
          const content = await page.content();
          
          // Successfully fetched content, return result
          return { content, contentType };
        } finally {
          // Ensure browser is closed
          await browser.close();
        }
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.error(`Attempt ${attempt + 1} failed: ${lastError.message}`);
        
        // If not the last attempt, wait before retrying
        if (attempt < Fetcher.MAX_RETRIES) {
          const delay = 1000 * (attempt + 1); // Gradually increase delay time
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed, throw the last error
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
      const { content } = await Fetcher._fetch(requestPayload);
      
      // Try to extract JSON from HTML
      let jsonContent = content;
      
      // Check if it's HTML-wrapped JSON
      if (content.includes("<pre>") && content.includes("</pre>")) {
        const preMatch = content.match(/<pre>([\s\S]*?)<\/pre>/);
        if (preMatch && preMatch[1]) {
          jsonContent = preMatch[1].trim();
        }
      }
      
      // Try to parse JSON
      try {
        const jsonObj = JSON.parse(jsonContent);
        return {
          content: [{ type: "text", text: JSON.stringify(jsonObj) }],
          isError: false,
        };
      } catch (parseError) {
        throw new Error("Response is not valid JSON");
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
      
      // Use JSDOM to parse HTML
      const dom = new JSDOM(content, { url: requestPayload.url });
      const document = dom.window.document;
      
      try {
        // Try to extract main content using Readability
        const reader = new Readability(document);
        const article = reader.parse();
        
        if (article && article.content) {
          // Create new DOM from extracted main content
          const cleanDom = new JSDOM(article.content);
          const cleanDocument = cleanDom.window.document;
          
          // Create TurndownService instance and configure options
          const turndownService = new TurndownService({
            headingStyle: 'atx',           // Use # style headings
            codeBlockStyle: 'fenced',      // Use ``` style code blocks
            emDelimiter: '*',              // Use * for italic delimiter
            strongDelimiter: '**',         // Use ** for bold delimiter
            bulletListMarker: '-',         // Use - for unordered list marker
            hr: '---',                     // Use --- for horizontal rule
            linkStyle: 'inlined'           // Use inline style links
          });
          
          // Custom escape function to reduce excessive escaping
          turndownService.escape = function(text) {
            // Only escape necessary Markdown characters
            return text
              // Escape backslashes
              .replace(/\\/g, '\\\\')
              // Escape number list format before headings
              .replace(/^(\d+)\.\s/gm, '$1\\. ')
              // Escape * and _ but only when they could be interpreted as format markers
              .replace(/([*_])/g, '\\$1')
              // Escape ` but only for single backticks
              .replace(/`/g, '\\`')
              // Escape [] and ()
              .replace(/\[/g, '\\[')
              .replace(/\]/g, '\\]')
              .replace(/\(/g, '\\(')
              .replace(/\)/g, '\\)')
              // Escape # but only at beginning of lines
              .replace(/^#/gm, '\\#');
          };
          
          // Add article title (if present)
          let markdown = '';
          if (article.title) {
            markdown += `# ${article.title}\n\n`;
          }
          
          // Add author information (if present)
          if (article.byline) {
            markdown += `*Author: ${article.byline}*\n\n`;
          }
          
          // Convert cleaned HTML to Markdown
          markdown += turndownService.turndown(cleanDocument.body.innerHTML);
          
          // Clean up excessive escaping and empty lines
          const cleanedMarkdown = markdown
            // Replace consecutive empty lines with maximum two empty lines
            .replace(/\n{3,}/g, '\n\n')
            // Remove trailing whitespace
            .replace(/[ \t]+$/gm, '')
            // Fix over-escaped issues
            .replace(/\\\\([*_`\[\]()#])/g, '\\$1')
            // Remove empty Markdown links
            .replace(/\[]\(.*?\)/g, '')
            // Remove lines containing only whitespace
            .replace(/^\s+$/gm, '');
          
          return { content: [{ type: "text", text: cleanedMarkdown }], isError: false };
        } else {
          // If Readability cannot extract content, fall back to original cleaning method
          console.log("Readability couldn't extract content, falling back to original cleaning method");
          throw new Error("Readability couldn't extract content");
        }
      } catch (readabilityError) {
        console.error("Readability processing failed:", readabilityError);
        
        // Fall back to original cleaning method
        // Remove all script tags
        const scripts = document.getElementsByTagName("script");
        Array.from(scripts).forEach((script) => script.remove());
        
        // Remove all style tags
        const styles = document.getElementsByTagName("style");
        Array.from(styles).forEach((style) => style.remove());
        
        // Remove all link tags (usually used to import external CSS)
        const links = document.getElementsByTagName("link");
        Array.from(links).filter(link => link.getAttribute("rel") === "stylesheet").forEach(link => link.remove());
        
        // Remove all noscript tags
        const noscripts = document.getElementsByTagName("noscript");
        Array.from(noscripts).forEach((noscript) => noscript.remove());
        
        // Remove all iframe tags
        const iframes = document.getElementsByTagName("iframe");
        Array.from(iframes).forEach((iframe) => iframe.remove());
        
        // Remove all svg tags
        const svgs = document.getElementsByTagName("svg");
        Array.from(svgs).forEach((svg) => svg.remove());
        
        // Remove all inline styles
        const elementsWithStyle = document.querySelectorAll("[style]");
        Array.from(elementsWithStyle).forEach((el) => el.removeAttribute("style"));
        
        // Get cleaned HTML
        const cleanedHtml = document.documentElement.outerHTML;
        
        // Create TurndownService instance and configure options
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          emDelimiter: '*',
          strongDelimiter: '**',
          bulletListMarker: '-',
          hr: '---',
          linkStyle: 'inlined'
        });
        
        // Custom escape function to reduce excessive escaping
        turndownService.escape = function(text) {
          return text
            .replace(/\\/g, '\\\\')
            .replace(/^(\d+)\.\s/gm, '$1\\. ')
            .replace(/([*_])/g, '\\$1')
            .replace(/`/g, '\\`')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/^#/gm, '\\#');
        };
        
        // Convert cleaned HTML to Markdown
        const markdown = turndownService.turndown(cleanedHtml);
        
        // Clean up excessive escaping and empty lines
        const cleanedMarkdown = markdown
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+$/gm, '')
          .replace(/\\\\([*_`\[\]()#])/g, '\\$1')
          .replace(/\[]\(.*?\)/g, '')
          .replace(/^\s+$/gm, '');
        
        return { content: [{ type: "text", text: cleanedMarkdown }], isError: false };
      }
    } catch (error) {
      return Fetcher._handleError(error);
    }
  }
}
