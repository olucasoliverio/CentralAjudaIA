// script-fine-tuning.js
const fs = require('fs');

// O seu Guia de Estilo básico como instrução global (System Prompt)
const SYSTEM_INSTRUCTION = `Você é o redator oficial da Central de Ajuda da Next Fit. Geração de artigos técnicos. Seja conciso, use tom imperativo e estruture os passos em narrativa flúida sem listas numeradas.`;

// Carregar seus artigos perfeitos atuais
const goldenArticles = require('./golden-articles.json');

const lines = [];

goldenArticles.forEach(article => {
  // Para cada artigo, criamos um exemplo de "prompt -> resposta desejada"
  const userPrompt = `Escreva um tutorial respondendo a seguinte intenção: ${article.title}`;
  const modelResponse = article.description;

  // Formato exigido pelo Vertex AI para Fine-Tuning do Gemini 1.5
  const jsonlLine = {
    systemInstruction: {
      role: "system",
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }]
      },
      {
        role: "model",
        parts: [{ text: modelResponse }]
      }
    ]
  };

  lines.push(JSON.stringify(jsonlLine));
});

// Salvar no formato JSONL
fs.writeFileSync('./dataset-treinamento-nextfit.jsonl', lines.join('\n'));
console.log(`Gerado dataset com ${lines.length} exemplos com sucesso!`);
