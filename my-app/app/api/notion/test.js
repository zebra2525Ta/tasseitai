//
const path = require("path");
//
const { pathToFileURL } = require("url");

async function main() {
  const notionModule = await import(pathToFileURL(path.join(__dirname, "notion.js")).href);
  const { runNotionFetchTest } = notionModule;
  const Data = await runNotionFetchTest(process.argv, process.env);
  console.log(JSON.stringify(Data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});