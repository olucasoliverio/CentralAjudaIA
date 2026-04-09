const API_BASE = 'http://localhost:4001';

async function request<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Erro desconhecido');
    throw new Error(text);
  }
  return res.json();
}

// ── Types ──

export interface ImpactArticle {
  articleId: string;
  title: string;
  impact: 'ALTO' | 'MEDIO' | 'BAIXO';
  reason: string;
  affected_excerpt?: string;
  suggested_update_instruction: string;
}

export interface ImpactResult {
  affected_articles: ImpactArticle[];
  summary: string;
}

export interface RevisedArticle {
  revised_content: string;
  changes_summary: string[];
  style_violations_fixed: string[];
  assumptions: string[];
}

export interface SearchResult {
  articleId: string;
  content: string;
  distance: number;
  title: string;
}

export interface GenerateResult {
  generated_content: string;
  sources: { id: string; title: string }[];
}

export interface QualityScore {
  score: number;
  issues: string[];
  priority: 'alta' | 'media' | 'baixa';
}

export interface StyleAnalysis {
  overall_score: number;
  follows_opening: boolean;
  follows_closing: boolean;
  conciseness: 'prolixo' | 'adequado' | 'curto';
  grammar_issues: string[];
  uses_imperative_tone: boolean;
  has_branching_links: boolean;
  has_visual_placeholders: boolean;
  suggested_improvements: string[];
  suggested_tags: string[];
}

// ── API Methods ──

export const api = {
  analyzeImpact(productMessage: string) {
    return request<ImpactResult>('/api/article/analyze-impact', { productMessage });
  },

  updateArticle(params: {
    articleId?: string;
    freshdeskId?: string;
    currentContent?: string;
    whatToChange?: string;
  }) {
    return request<RevisedArticle>('/api/article/update', params);
  },

  search(query: string, topK = 5) {
    return request<SearchResult[]>('/api/article/search', { query, topK });
  },

  generate(prompt: string) {
    return request<GenerateResult>('/api/article/generate', { prompt });
  },

  qualityScore(params: {
    articleContent?: string;
    articleId?: string;
    freshdeskId?: string;
  }) {
    return request<QualityScore>('/api/article/quality-score', params);
  },

  analyzeStyle(articleContents: string[]) {
    return request<StyleAnalysis[]>('/api/article/analyze-style', { articleContents });
  },

  syncArticles() {
    return request<{ message: string }>('/api/sync-articles');
  },
};
