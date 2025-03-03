# BigGo playwright-fetch MCP Server

此 MCP 伺服器提供以各種格式擷取網頁內容的功能，包括 HTML、JSON、純文字和 Markdown。

## 安裝

### 先決條件

在使用此工具前，需要安裝 Playwright 及其瀏覽器依賴：

#### Windows
```bash
npm install -g playwright
npx playwright install chromium
```

#### macOS
```bash
npm install -g playwright
npx playwright install chromium
```

#### Linux
```bash
npm install -g playwright
npx playwright install chromium
```

### 安裝方式

#### 通過 npm 安裝
```bash
npm install @kevinwatt/biggo-eclimit-fetch-mcp
```

#### 從源碼安裝
```bash
git clone https://github.com/kevinwatt/BigGo-eclimit-playwright-fetch-mcp.git
cd BigGo-eclimit-playwright-fetch-mcp
npm install
npm run build
```

## 組件

### 工具

- **fetch_html**
  - 擷取網站並返回 HTML 格式的內容
  - 輸入:
    - `url` (字串, 必填): 要擷取的網站 URL
    - `headers` (物件, 選填): 請求中要包含的自訂標頭
  - 返回網頁的原始 HTML 內容

- **fetch_json**
  - 從 URL 擷取 JSON 文件
  - 輸入:
    - `url` (字串, 必填): 要擷取的 JSON URL
    - `headers` (物件, 選填): 請求中要包含的自訂標頭
  - 返回解析過的 JSON 內容

- **fetch_txt**
  - 擷取網站並返回純文字內容（不含 HTML）
  - 輸入:
    - `url` (字串, 必填): 要擷取的網站 URL
    - `headers` (物件, 選填): 請求中要包含的自訂標頭
  - 返回去除 HTML 標籤、腳本和樣式的純文字網頁內容

- **fetch_markdown**
  - 擷取網站並將內容轉換為 Markdown 格式
  - 輸入:
    - `url` (字串, 必填): 要擷取的網站 URL
    - `headers` (物件, 選填): 請求中要包含的自訂標頭
  - 返回轉換後的 Markdown 格式網頁內容

### 資源

此伺服器不提供任何持久資源。它被設計為根據需求擷取和轉換網頁內容。

## 快速入門

1. 克隆此儲存庫
2. 安裝依賴: `npm install`
3. 建置伺服器: `npm run build`

### 用法

直接運行此伺服器:

```bash
npm start
```

這將以 stdio 模式啟動 Fetch MCP 伺服器。

### 與桌面應用程式一起使用

要將此伺服器整合到桌面應用程式中，在應用程式的伺服器配置中添加以下內容:

#### 使用本地安裝的方式

```json
{
  "mcpServers": {
    "playwright-fetch": {
      "command": "node",
      "args": [
        "/path/to/your/dist/index.js"
      ],
      "enabled": true,
      "env": {
        "fetch_html": "Enable",
        "DNListCheck": "Disable"
      }
    }
  }
}
```

#### 使用 npx 方式（推薦）

```json
{
  "mcpServers": {
    "playwright-fetch": {
      "command": "npx",
      "args": [
        "-y",
        "@kevinwatt/biggo-eclimit-fetch-mcp"
      ],
      "enabled": true,
      "env": {
        "fetch_html": "Disable",
        "DNListCheck": "Disable"
      }
    }
  }
}
```

### 環境變量設置

此 MCP 伺服器支援以下環境變量：

- **fetch_html**
  - 功能：控制 fetch_html 工具是否啟用
  - 值：
    - `"Enable"`: 啟用 fetch_html 工具
    - `"Disable"`: 禁用 fetch_html 工具（預設）
  - 說明：預設情況下，fetch_html 工具是禁用的，需要明確啟用才能使用

- **DNListCheck**
  - 功能：控制是否檢查 URL 是否為電子商務網站
  - 值：
    - `"Enable"`: 啟用 DNList 檢查（預設）
    - `"Disable"`: 禁用 DNList 檢查
  - 說明：預設情況下，伺服器會檢查 URL 是否為允許的電子商務網站，可以禁用此功能以抓取任何網站

## DNList 功能

DNList（Domain Name List）是一個用於管理和驗證電子商務網站域名的模組。此功能確保 Fetch 工具僅能爬取合法的電子商務網站，防止濫用。

### 主要功能

- **快取管理**：DNList 使用本地快取文件（`dnlist.cache.json`）存儲允許的域名列表，減少對遠程 API 的請求次數。
- **自動更新**：快取設有 30 分鐘的有效期（TTL），過期後會自動從遠程 API 更新。
- **域名驗證**：提供 `isAllowed` 方法，用於檢查 URL 是否屬於允許的電子商務網站。
- **正規表達式匹配**：使用正規表達式進行域名匹配，支援複雜的匹配模式。
- **主機名標準化**：自動移除 "www." 前綴，確保 `example.com` 和 `www.example.com` 被視為相同域名。

### 技術實現

DNList 類提供以下靜態方法：

- **loadCache()**：從本地文件加載快取的域名列表。
- **updateCache()**：從遠程 API 獲取最新的域名列表並更新本地快取。
- **getValidCache()**：獲取有效的快取，如果快取過期則自動更新。
- **isAllowed(url)**：檢查給定 URL 是否屬於允許的電子商務網站。

### 使用方式

在 Fetcher 類中，每次請求前都會調用 DNList.isAllowed() 方法進行驗證：

```typescript
const allowed = await DNList.isAllowed(url);
if (!allowed) {
  throw new Error("Not a EC site. Fetch Tools only crawler EC Site.");
}
```

### 快取文件格式

快取文件（`dnlist.cache.json`）使用以下格式：

```json
{
  "updatedAt": 1234567890123, // 時間戳（毫秒）
  "entries": [
    {
      "ptn": "example\\.com" // 域名匹配模式（正規表達式）
    },
    // 更多域名項目...
  ]
}
```

## 特點

- 使用 Playwright 擷取網頁內容，支援現代網頁和動態內容
- 支援請求中自訂標頭
- 提供多種格式的內容: HTML、JSON、純文字和 Markdown
- 使用 JSDOM 解析 HTML 並提取文字
- 使用 TurndownService 將 HTML 轉換為 Markdown
- 整合 DNList 功能，僅允許爬取合法的電子商務網站
- 支援重定向，最多允許 3 層重定向
- 實現重試機制，最多重試 2 次
- 可通過環境變量控制功能啟用/禁用

## 開發

- 執行 `npm run dev` 以監看模式啟動 TypeScript 編譯器
- 使用 `npm test` 執行測試套件

## 授權

此專案採用 GNU Affero (GNU AGPL) 授權條款。
