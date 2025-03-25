# Playwright Fetch MCP Server

This MCP server provides functionality to fetch web content in various formats, including JSON, plain text, and Markdown.

## Installation

### Prerequisites

Before using this tool, you need to install Playwright and its browser dependencies:

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

### Installation Methods

#### Via npm
```bash
npm install @kevinwatt/playwright-fetch-mcp
```

#### From source code
```bash
git clone https://github.com/kevinwatt/playwright-fetch-mcp.git
cd playwright-fetch-mcp
npm install
npm run build
```

## Components

### Tools

- **fetch_json**
  - Fetches JSON content from a URL
  - Input:
    - `url` (string, required): The URL of the JSON resource to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the parsed JSON content

- **fetch_txt**
  - Fetches a website and returns plain text content (HTML tags removed)
  - Input:
    - `url` (string, required): The URL of the website to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the plain text content of the webpage with HTML tags, scripts, and styles removed

- **fetch_markdown**
  - Fetches a website and converts its content to Markdown format
  - Input:
    - `url` (string, required): The URL of the website to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the webpage content converted to Markdown format

### Resources

This server does not provide any persistent resources. It is designed to fetch and transform web content on demand.

## Quick Start

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the server: `npm run build`

### Usage

Run the server directly:

```bash
npm start
```

This will start the Fetch MCP server in stdio mode.

### Integration with Desktop Applications

To integrate this server with a desktop application, add the following to your server configuration:

#### Using local installation

```json
{
  "mcpServers": {
    "playwright-fetch": {
      "command": "node",
      "args": [
        "/path/to/your/dist/index.js"
      ],
      "enabled": true
    }
  }
}
```

#### Using npx (recommended)

```json
{
  "mcpServers": {
    "playwright-fetch": {
      "command": "npx",
      "args": [
        "-y",
        "@kevinwatt/playwright-fetch-mcp"
      ],
      "enabled": true
    }
  }
}
```

## Features

- Uses Playwright to fetch web content, supporting modern websites and dynamic content
- Supports custom headers in requests
- Provides content in multiple formats: JSON, plain text, and Markdown
- Uses JSDOM to parse HTML and extract text
- Uses TurndownService to convert HTML to Markdown
- Supports redirects, with a maximum of 3 redirect levels
- Implements retry mechanism, with up to 2 retries
- Automatically installs Chromium browser on package installation

## Development

- Run `npm run dev` to start the TypeScript compiler in watch mode
- Use `npm test` to run the test suite

## License

This project is licensed under the MIT License.
