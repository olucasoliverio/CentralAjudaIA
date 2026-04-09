import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // If we are given a Base64 string for GCP credentials (e.g. in Railway)
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    const credsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
    const tempPath = path.join(require('os').tmpdir(), 'gcp-credentials.json');
    fs.writeFileSync(tempPath, credsJson);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempPath;
  }

  // Strict validaton for frontend URL
  if (!process.env.FRONTEND_URL) {
    console.error('CRITICAL: FRONTEND_URL is not set. Cannot configure CORS securely.');
    process.exit(1);
  }

  if (!process.env.BACKEND_API_KEY) {
    console.error('CRITICAL: BACKEND_API_KEY is not set. API will lack authentication.');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  
  // Protect all routes globally
  app.useGlobalGuards(new ApiKeyGuard());

  // Strict CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
