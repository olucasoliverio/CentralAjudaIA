const fs = require('fs');
const data = require('./golden-articles.json');

let content = `export const GOLDEN_ARTICLES_PROMPT = \`\n\n=== EXEMPLOS DE ARTIGOS DE OURO (SIGA ESTRICTAMENTE ESTE PADRÃO DE FORMATO E TOM DE VOZ) ===\n\n`;

data.forEach(d => {
  const safeDesc = d.description.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  content += `TÍTULO: ${d.title}\n${safeDesc}\n\n-----------------\n\n`;
});

content += `\`;\n`;

const targetFile = './src/modules/ai/golden-articles.ts';
fs.writeFileSync(targetFile, content);
console.log('Successfully wrote to ' + targetFile);
