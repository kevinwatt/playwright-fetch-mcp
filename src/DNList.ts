import { promises as fs } from "fs";
import path from "path";

const CACHE_FILE = path.join(__dirname, "../dnlist.cache.json");
const CACHE_TTL = 30 * 60 * 1000; // 30 分鐘

interface DNEntry {
  ptn: string;
  // 可加入其他欄位
}

interface DNListCache {
  updatedAt: number;
  entries: DNEntry[];
}

export class DNList {
  static async loadCache(): Promise<DNListCache | null> {
    try {
      const data = await fs.readFile(CACHE_FILE, "utf-8");
      return JSON.parse(data) as DNListCache;
    } catch {
      return null;
    }
  }

  static async updateCache(): Promise<DNListCache> {
    const response = await fetch("https://extension.biggo.com/api/eclist.php");
    const remoteData = await response.json() as { data: { tw: Record<string, DNEntry> } };
    // 從 remoteData 解析出 DNListCache 格式資料
    // 這裡假設 remoteData.data.tw 為我們需要的物件，並取出其中的 ptn
    const entries: DNEntry[] = Object.values(remoteData.data.tw);
    const cache: DNListCache = {
      updatedAt: Date.now(),
      entries,
    };
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache), "utf-8");
    return cache;
  }

  static async getValidCache(): Promise<DNListCache> {
    let cache = await this.loadCache();
    const now = Date.now();
    if (!cache || now - cache.updatedAt > CACHE_TTL) {
      cache = await this.updateCache();
    }
    return cache;
  }

  static async isAllowed(url: string): Promise<boolean> {
    const { hostname } = new URL(url);
    // 移除主機名稱中的 "www." 前綴，使得 rakuten.com.tw 與 www.rakuten.com.tw 均能正確比對
    const normalizedHostname = hostname.replace(/^www\./, "");
    const cache = await this.getValidCache();
    return cache.entries.some((entry) => {
      const regex = new RegExp(entry.ptn, "i");
      return regex.test(normalizedHostname);
    });
  }
} 