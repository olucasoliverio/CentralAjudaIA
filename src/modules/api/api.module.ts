import { Module } from '@nestjs/common';
import { ArticleController } from './article/article.controller';
import { SyncController } from './sync/sync.controller';
import { AiModule } from '../ai/ai.module';
import { VectorDbModule } from '../vector-db/vector-db.module';
import { RagModule } from '../rag/rag.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [AiModule, VectorDbModule, RagModule, QueueModule],
  controllers: [ArticleController, SyncController],
})
export class ApiModule {}
