const defaultNotionVersion = "2022-06-28";

const apiKey = process.env.NOTION_API_KEY;
const databaseId = process.env.NOTION_DATABASE_ID;

function buildHeaders(key) {
  return {
    Authorization: `Bearer ${key}`,
    "Notion-Version": defaultNotionVersion,
    "Content-Type": "application/json",
  };
}

function plainTextFromRichText(items) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => item?.plain_text || "").join("");
}

function simplifyPropertyValue(property) {
  if (!property || typeof property !== "object") return null;

  switch (property.type) {
    case "title":
      return plainTextFromRichText(property.title);
    case "rich_text":
      return plainTextFromRichText(property.rich_text);
    case "number":
    case "checkbox":
    case "url":
    case "email":
    case "phone_number":
    case "created_time":
    case "last_edited_time":
      return property[property.type];
    case "select":
      return property.select ? property.select.name : null;
    case "multi_select":
      return Array.isArray(property.multi_select)
        ? property.multi_select.map((item) => item.name)
        : [];
    case "date":
      return property.date || null;
    case "people":
      return Array.isArray(property.people)
        ? property.people.map((person) => person?.name || person?.email || null).filter(Boolean)
        : [];
    case "files":
      return Array.isArray(property.files)
        ? property.files.map((file) => file.name || file.file?.url || file.external?.url)
        : [];
    case "relation":
      return Array.isArray(property.relation)
        ? property.relation.map((relation) => relation.id)
        : [];
    case "formula":
      if (!property.formula) return null;
      return property.formula.string ?? property.formula.number ?? property.formula.boolean ?? property.formula.date ?? null;
    case "rollup":
      if (!property.rollup) return null;
      return property.rollup.array ?? property.rollup.number ?? property.rollup.string ?? property.rollup.date ?? null;
    case "created_by":
    case "last_edited_by":
      return property[property.type]?.name || property[property.type]?.email || null;
    default:
      return property[property.type] ?? null;
  }
}

export function extractNotionProperties(properties = {}) {
  if (!properties || typeof properties !== "object") return {};
  return Object.entries(properties).reduce((acc, [name, property]) => {
    acc[name] = simplifyPropertyValue(property);
    return acc;
  }, {});
}

export function extractNotionTitle(page) {
  const titleProperty = Object.values(page.properties || {}).find(
    (property) => property?.type === "title"
  );
  if (titleProperty) {
    return plainTextFromRichText(titleProperty.title);
  }

  return page.url || page.id || "";
}

export function collectNotionPageInfo(page) {
  return {
    id: page.id,
    url: page.url ?? null,
    title: extractNotionTitle(page),
    parent: page.parent ?? null,
    created_time: page.created_time ?? null,
    last_edited_time: page.last_edited_time ?? null,
    icon: page.icon ?? null,
    cover: page.cover ?? null,
    properties: extractNotionProperties(page.properties),
  };
}

export function filterNotionPagesByQuery(pages, query) {
  const lowerQuery = (query || "").toLowerCase();
  if (!lowerQuery) return pages;

  return pages.filter((page) => {
    const title = extractNotionTitle(page) || "";
    if (title.toLowerCase().includes(lowerQuery)) return true;

    const propertyValues = Object.values(extractNotionProperties(page.properties));
    return propertyValues.some((value) => {
      if (typeof value === "string") {
        return value.toLowerCase().includes(lowerQuery);
      }
      if (Array.isArray(value)) {
        return value.some((item) => typeof item === "string" && item.toLowerCase().includes(lowerQuery));
      }
      if (value && typeof value === "object") {
        return JSON.stringify(value).toLowerCase().includes(lowerQuery);
      }
      return false;
    });
  });
}

async function fetchNotionJson(url, apiKey, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export async function queryNotionDatabase(
  apiKeyValue,
  databaseIdValue,
  pageSize = 50,
  maxPages = 5,
  filter = null,
  sorts = null
) {
  const results = [];
  let nextCursor = null;
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const safeMaxPages = Math.min(Math.max(maxPages, 1), 20);

  do {
    const body = {
      page_size: safePageSize,
    };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (nextCursor) body.start_cursor = nextCursor;

    const data = await fetchNotionJson(
      `https://api.notion.com/v1/databases/${databaseIdValue}/query`,
      apiKeyValue,
      body
    );

    if (Array.isArray(data.results)) {
      results.push(...data.results);
    }
    nextCursor = data.next_cursor;
  } while (nextCursor && results.length < safePageSize * safeMaxPages);

  return results;
}

export async function searchNotionPages(apiKeyValue, query, pageSize = 50, maxPages = 3) {
  const results = [];
  let nextCursor = null;
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const safeMaxPages = Math.min(Math.max(maxPages, 1), 10);

  do {
    const body = {
      query,
      filter: {
        value: "page",
        property: "object",
      },
      page_size: safePageSize,
    };
    if (nextCursor) body.start_cursor = nextCursor;

    const data = await fetchNotionJson("https://api.notion.com/v1/search", apiKeyValue, body);

    if (Array.isArray(data.results)) {
      results.push(...data.results);
    }
    nextCursor = data.next_cursor;
  } while (nextCursor && results.length < safePageSize * safeMaxPages);

  return results;
}

export { apiKey, databaseId };
