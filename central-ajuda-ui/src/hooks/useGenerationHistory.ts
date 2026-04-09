/**
 * useGenerationHistory — Hook para gerenciar histórico de artigos gerados.
 * Persiste no localStorage com limite de 25 entradas.
 */

import { useState, useEffect, useCallback } from 'react';

export interface GenerationEntry {
  id: string;
  timestamp: string;       // ISO
  prompt: string;          // PRD digitada pelo usuário
  content: string;         // Markdown gerado
  sources: { id: string; title: string }[];
}

const STORAGE_KEY = 'central-ajuda:generation-history';
const MAX_ENTRIES = 25;

function loadFromStorage(): GenerationEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: GenerationEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage cheio — ignora silenciosamente
  }
}

export function useGenerationHistory() {
  const [history, setHistory] = useState<GenerationEntry[]>(loadFromStorage);

  // Sincroniza ao montar (caso outra aba tenha atualizado)
  useEffect(() => {
    setHistory(loadFromStorage());
  }, []);

  const addEntry = useCallback((
    prompt: string,
    content: string,
    sources: { id: string; title: string }[]
  ) => {
    const entry: GenerationEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      prompt,
      content,
      sources,
    };

    setHistory(prev => {
      // Mais recente primeiro, limita ao máximo
      const next = [entry, ...prev].slice(0, MAX_ENTRIES);
      saveToStorage(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setHistory(prev => {
      const next = prev.filter(e => e.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  return { history, addEntry, clearHistory, removeEntry };
}
