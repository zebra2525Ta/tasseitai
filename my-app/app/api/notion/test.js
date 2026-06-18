const path = require("path");
const { pathToFileURL } = require("url");

function parseInput(name, envName) {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (arg) {
    return arg.slice(prefix.length);
  }
  return process.env[envName] || undefined;
}

async function main() {
  const apiKey = parseInput("apiKey", "NOTION_API_KEY");
  const databaseId = parseInput("databaseId", "NOTION_DATABASE_ID");
  const query = parseInput("query", "NOTION_QUERY");
  const searchType = parseInput("searchType", "NOTION_SEARCH_TYPE") === "search" ? "search" : "database";
  const pageSize = Number(parseInput("pageSize", "NOTION_PAGE_SIZE") || 10);
  const maxPages = Number(parseInput("maxPages", "NOTION_MAX_PAGES") || 2);

  if (!apiKey) {
    console.error("ERROR: apiKey が必要です。例: node test.js apiKey=your-token");
    process.exit(1);
  }

  if (searchType === "database" && !databaseId) {
    console.error("ERROR: databaseId が必要です。例: node test.js databaseId=your-database-id");
    process.exit(1);
  }

  if (searchType === "search" && !query) {
    console.error("ERROR: query が必要です。例: node test.js searchType=search query=検索語");
    process.exit(1);
  }

  const notionModule = await import(pathToFileURL(path.join(__dirname, "notion.js")).href);
  const { queryNotionDatabase, searchNotionPages, collectNotionPageInfo } = notionModule;

  let pages = [];
  let source = "database";

  if (searchType === "search") {
    pages = await searchNotionPages(apiKey, query, pageSize, maxPages);
    source = "search";
  } else {
    pages = await queryNotionDatabase(apiKey, databaseId, pageSize, maxPages);
  }

  const results = pages.map((page) => collectNotionPageInfo(page));
  console.log(JSON.stringify({ source, count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});