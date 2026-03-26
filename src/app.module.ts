import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FreshdeskModule } from './modules/freshdesk/freshdesk.module';
import { ContentModule } from './modules/content/content.module';
import { AiModule } from './modules/ai/ai.module';
import { VectorDbModule } from './modules/vector-db/vector-db.module';
import { QueueModule } from './modules/queue/queue.module';
import { ApiModule } from './modules/api/api.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FreshdeskModule,
    ContentModule,
    AiModule,
    VectorDbModule,
    QueueModule,
    ApiModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
