import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VectorDbService {
  constructor(private readonly prisma: PrismaService) {}

  async saveArticleAndChunks(
    freshdeskId: string,
    title: string,
    description: string,
    category: string | null,
    tags: string[],
    freshdeskUpdatedAt: Date | null,
    chunksData: { content: string; embedding: number[]; tokenCount: number }[],
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const article = await tx.article.upsert({
        where: { freshdeskId },
        update: { title, description, category, tags: { set: tags }, freshdeskUpdatedAt },
        create: {
          freshdeskId,
          title,
          description,
          category,
          tags: { set: tags },
          freshdeskUpdatedAt,
        },
      });

      await tx.chunk.deleteMany({ where: { articleId: article.id } });

      for (const chunk of chunksData) {
        const formattedEmbedding = `[${chunk.embedding.join(',')}]`;
        await tx.$executeRawUnsafe(
          `INSERT INTO chunks (id, "articleId", content, embedding, "tokenCount", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3::vector, $4, NOW())`,
          article.id,
          chunk.content,
          formattedEmbedding,
          chunk.tokenCount,
        );
      }
      return article;
    });
  }

  async semanticSearch(
    embedding: number[],
    topK: number = 3,
  ): Promise<{ articleId: string; content: string; distance: number }[]> {
    const formattedEmbedding = `[${embedding.join(',')}]`;
    const results = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "articleId", content, embedding <=> $1::vector as distance
       FROM chunks
       ORDER BY distance ASC
       LIMIT $2`,
      formattedEmbedding,
      topK,
    );
    return results;
  }
}
