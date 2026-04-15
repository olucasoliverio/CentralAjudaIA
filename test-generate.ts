import 'dotenv/config';
import { AiService } from './src/modules/ai/ai.service';
import { Logger } from '@nestjs/common';

async function run() {
  const ai = new AiService();
  // ai['logger'] = new Logger('Test');
  
  try {
    const res = await ai['ai'].models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Diga Oi marujo"
    });
    require('fs').writeFileSync('result.txt', JSON.stringify(res, null, 2));
    console.log("Salvo em result.txt");
  } catch (e) {
    console.error("ERRO:", e);
  }
}

run();
