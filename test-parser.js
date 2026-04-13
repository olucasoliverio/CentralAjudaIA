const { AiService } = require('./dist/modules/ai/ai.service');

const ai = new AiService();

// Mock logger para não estourar verbosidade
ai.logger = { debug: console.log, error: console.error, warn: console.warn, log: console.log };

console.log("=== TESTANDO parseImpactReport ===");
const xmlImpact = `
<thinking>
Pensando...
</thinking>
<summary>
Resumo do impacto
</summary>
<affected_articles>
[
  {
    "ARTICLE_ID": "123",
    "TITLE": "Artigo Teste",
    "IMPACT": "ALTO",
    "REASON": "Motivo teste",
    "EXCERPT": "Trecho teste",
    "UPDATE_INSTRUCTION": "Instrução"
  }
]
</affected_articles>
`;
const parsedImpact = ai.parseImpactReport(xmlImpact);
console.log(JSON.stringify(parsedImpact, null, 2));

console.log("\n=== TESTANDO extractJson ===");
const jsonString = ai.extractJson(\`<thinking>Oi</thinking>\n\`\`\`json\n{"hello": "world"}\n\`\`\`\`);
console.log(jsonString);

console.log("\n=== TESTANDO verifyArticleImpact regex extraction ===");
// Como verifyArticleImpact chama a API, vamos apenas testar a Regex de evaluation manualmente
const evalXml = \`
<thinking>
Pensando...
</thinking>
<evaluation>
{
  "confirmed": true,
  "confidence": "ALTA",
  "reason": "Test reason",
  "excerpt": "Test excerpt",
  "instruction": "Test instruction"
}
</evaluation>
\`;
const cleanEval = ai.cleanThinkingTags(evalXml);
const evalMatch = cleanEval.match(/<evaluation>([\\s\\S]*?)<\\/evaluation>/i);
console.log(evalMatch ? JSON.parse(evalMatch[1]) : "Falha na Extração");
