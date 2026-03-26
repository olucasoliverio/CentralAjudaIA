import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface FreshdeskArticle {
  id: number;
  title: string;
  description: string;
  category_id?: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

@Injectable()
export class FreshdeskService {
  private readonly logger = new Logger(FreshdeskService.name);
  
  private get baseUrl() {
    return process.env.FRESHDESK_URL || '';
  }
  
  private get apiKey() {
    return process.env.FRESHDESK_API_KEY || '';
  }

  private get auth() {
    return { username: this.apiKey, password: 'X' };
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async fetchAllArticles(): Promise<FreshdeskArticle[]> {
    this.logger.log('Buscando arvore de categorias e folders do Freshdesk...');
    const allArticles: FreshdeskArticle[] = [];

    try {
      // 1. Pegar todas as categorias
      const categoriesRes = await axios.get(`${this.baseUrl}/solutions/categories`, { auth: this.auth });
      const categories = categoriesRes.data;

      for (const category of categories) {
        await this.sleep(1000); // 1 request / second max

        // 2. Pegar todas as pastas da categoria
        const foldersRes = await axios.get(`${this.baseUrl}/solutions/categories/${category.id}/folders`, { auth: this.auth });
        const folders = foldersRes.data;

        for (const folder of folders) {
          // 3. Pegar artigos de cada pasta
          let page = 1;
          while (true) {
            await this.sleep(1000); // 1 request / second max
            const articlesRes = await axios.get(`${this.baseUrl}/solutions/folders/${folder.id}/articles`, {
              params: { page, per_page: 30 },
              auth: this.auth
            });
            const articles = articlesRes.data;
            if (articles.length === 0) break;
            
            allArticles.push(...articles);
            page++;
          }
        }
      }
      return allArticles;
    } catch (error) {
      this.logger.error('Erro ao buscar artigos no Freshdesk', error?.message || error);
      throw error;
    }
  }
}
