import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { FreshdeskModule } from '../freshdesk/freshdesk.module';
import { ContentModule } from '../content/content.module';
import { AiModule } from '../ai/ai.module';
import { VectorDbModule } from '../vector-db/vector-db.module';

@Module({
  imports: [FreshdeskModule, ContentModule, AiModule, VectorDbModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class QueueModule {}
