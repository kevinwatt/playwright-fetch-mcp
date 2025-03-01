# Fetch MCP 伺服器

![fetch mcp logo](logo.jpg)

此 MCP 伺服器提供以各種格式擷取網頁內容的功能，包括 HTML、JSON、純文字和 Markdown。

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

```json
{
  "mcpServers": {
    "fetch": {
      "command": "node",
      "args": [
        "{ABSOLUTE PATH TO FILE HERE}/dist/index.js"
      ]
    }
  }
}
```

## 特點

- 使用現代 fetch API 擷取網頁內容
- 支援請求中自訂標頭
- 提供多種格式的內容: HTML、JSON、純文字和 Markdown
- 使用 JSDOM 解析 HTML 並提取文字
- 使用 TurndownService 將 HTML 轉換為 Markdown

## 開發

- 執行 `npm run dev` 以監看模式啟動 TypeScript 編譯器
- 使用 `npm test` 執行測試套件

## 授權

此專案採用 MIT 授權條款。
