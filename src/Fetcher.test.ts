import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { DNList } from "./DNList.js";
import { chromium } from "playwright";
import { jest, expect, describe, beforeEach, afterEach, it } from '@jest/globals';
import { Fetcher } from "./Fetcher.js";

// Save original environment variables
const originalEnv = { ...process.env };

// Test sites
const testSites = {
  ec: "https://www.rakuten.com.tw/", // E-commerce site
  nonEc: "https://www.google.com/", // Non-e-commerce site
  json: "https://jsonplaceholder.typicode.com/todos/1", // JSON API
  error: "https://httpstat.us/404" // Error page
};

// Test suite
describe("Fetcher", () => {
  // Run before each test
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("DNList check", () => {
    it("should skip DNList check when DNListCheck is set to Disable", async () => {
      // Set environment variable
      process.env.DNListCheck = "Disable";
      
      // Spy on DNList.isAllowed method
      const isAllowedSpy = jest.spyOn(DNList, 'isAllowed');
      
      // Use a non-EC site, but should be accessible since DNListCheck is Disable
      const result = await Fetcher.json({ url: testSites.nonEc });
      
      // Verify isAllowed was not called
      expect(isAllowedSpy).not.toHaveBeenCalled();
      
      // Restore original method
      isAllowedSpy.mockRestore();
    }, 30000); // Increase timeout
  });

  describe("json", () => {
    beforeEach(() => {
      // Disable DNList check to test other functionality
      process.env.DNListCheck = "Disable";
    });

    it("should parse and return JSON content", async () => {
      const result = await Fetcher.json({ url: testSites.json });
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBeDefined();
      // Verify JSON format
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty("id");
      expect(parsed).toHaveProperty("title");
    }, 30000); // Increase timeout

    it("should handle non-JSON content", async () => {
      const result = await Fetcher.json({ url: testSites.nonEc });
      // Even if not JSON, it should attempt to parse
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBeDefined();
    }, 30000); // Increase timeout
  });

  describe("txt", () => {
    beforeEach(() => {
      // Disable DNList check to test other functionality
      process.env.DNListCheck = "Disable";
    });

    it("should return plain text content without HTML tags", async () => {
      const result = await Fetcher.txt({ url: testSites.nonEc });
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBeDefined();
      // Should not contain HTML tags
      expect(result.content[0].text).not.toContain("<html");
      expect(result.content[0].text).not.toContain("<body");
    }, 30000); // Increase timeout
  });

  describe("markdown", () => {
    beforeEach(() => {
      // Disable DNList check to test other functionality
      process.env.DNListCheck = "Disable";
    });

    it("should convert HTML to Markdown", async () => {
      const result = await Fetcher.markdown({ url: testSites.nonEc });
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBeDefined();
      // Markdown format check
      expect(result.content[0].text).not.toContain("<html");
      expect(result.content[0].text).not.toContain("<body");
    }, 30000); // Increase timeout
  });
});
