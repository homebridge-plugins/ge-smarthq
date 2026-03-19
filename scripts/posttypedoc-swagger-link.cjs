// posttypedoc-swagger-link.cjs
// Adds a Swagger UI link to the TypeDoc index.html after the main <h1> heading.

const fs = require('fs');
const path = require('path');

const DOCS_INDEX = path.join(__dirname, '../docs', 'index.html');
const SWAGGER_LINK = '<p><a href="swagger/index.html" style="font-size:1.1em;font-weight:bold;color:#1976d2;">📖 View OpenAPI (Swagger) API Reference</a></p>';

let html = fs.readFileSync(DOCS_INDEX, 'utf8');

// Find the first <h1 id="ge-smarthq-api-client" ...> and insert after it
const h1Regex = /(<h1 id="ge-smarthq-api-client"[^>]*>.*?<\/h1>)/;
if (h1Regex.test(html) && !html.includes(SWAGGER_LINK)) {
  html = html.replace(h1Regex, `$1\n${SWAGGER_LINK}`);
  fs.writeFileSync(DOCS_INDEX, html, 'utf8');
  console.log('Swagger UI link added to docs/index.html');
} else if (html.includes(SWAGGER_LINK)) {
  console.log('Swagger UI link already present.');
} else {
  console.error('Could not find <h1 id="ge-smarthq-api-client"> in docs/index.html');
}
