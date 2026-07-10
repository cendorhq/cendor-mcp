import type { DocChunk, DocIndex, Product } from './types.js';

export interface SearchHit {
  title: string;
  url: string;
  product: Product;
  snippet: string;
  score: number;
}

const tokenize = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z0-9_.]+/g) || []).filter((t) => t.length > 1);

function occurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

/** A short, term-centered excerpt of a chunk (single line, collapsed whitespace). */
function excerpt(chunk: DocChunk, terms: string[]): string {
  const flat = chunk.text.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  const start = at === -1 ? 0 : Math.max(0, at - 60);
  const slice = flat.slice(start, start + 240);
  return (start > 0 ? '…' : '') + slice + (start + 240 < flat.length ? '…' : '');
}

/** Tiny offline scoring search over the doc chunks. Title/heading hits weigh most. */
export function searchDocs(index: DocIndex, query: string, limit = 6): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const chunk of index.chunks) {
    const hayTitle = `${chunk.title} ${chunk.heading}`.toLowerCase();
    const hayText = chunk.text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (hayTitle.includes(term)) score += 6;
      score += Math.min(occurrences(hayText, term), 5);
    }
    if (score > 0) {
      hits.push({
        title: chunk.title,
        url: chunk.url,
        product: chunk.product,
        snippet: excerpt(chunk, terms),
        score,
      });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
