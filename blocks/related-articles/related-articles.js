import { readBlockConfig } from '../../scripts/aem.js';
import {
  createTag,
  fetchQueryIndexAll,
  formatDate,
  getArticleKeywords,
  getAuthoredLinks,
  getContentTimestamp,
  normalizePath,
  parseKeywords,
  resolveArticlesFromIndex,
  shuffle,
} from '../../scripts/shared.js';

const RESULT_LIMIT = 5;

function rowMatchesKeyword(row, keyword) {
  const articleKeywords = parseKeywords(getArticleKeywords(row));
  return articleKeywords.some((ak) => ak === keyword || ak.includes(keyword));
}

function matchArticles(rows, keywordsConfig, excludedConfig, limit) {
  const requested = parseKeywords(keywordsConfig);
  const excluded = parseKeywords(excludedConfig);
  const isRandom = requested.includes('random');
  const hasMultipleKeywords = requested.filter((k) => k !== 'random').length > 1;
  const shouldShuffle = isRandom || hasMultipleKeywords;

  const filtered = isRandom || !requested.length
    ? rows
    : rows.filter((row) => requested.some((keyword) => rowMatchesKeyword(row, keyword)));

  const withoutExcluded = excluded.length
    ? filtered.filter((row) => !excluded.some((keyword) => rowMatchesKeyword(row, keyword)))
    : filtered;

  const deduped = withoutExcluded.filter((row, idx, arr) => {
    const firstIdx = arr.findIndex((x) => x.path === row.path);
    return firstIdx === idx;
  });
  if (shouldShuffle) return shuffle(deduped).slice(0, limit);

  return deduped
    .sort((a, b) => getContentTimestamp(b) - getContentTimestamp(a))
    .slice(0, limit);
}

function buildCard(article, index) {
  const href = normalizePath(article.path);
  const link = createTag('a', { href, class: 'related-articles-card-link' });

  const content = createTag('div', { class: 'related-articles-card-content' });

  // Keyword tag
  const keywords = parseKeywords(getArticleKeywords(article));
  if (keywords.length > 0) {
    content.append(createTag('span', { class: 'related-articles-card-tag' }, keywords[0]));
  }

  content.append(createTag('h3', {}, article.title || href));
  if (article.description) {
    content.append(createTag('p', { class: 'related-articles-card-description' }, article.description));
  }
  const date = article.date || article.publisheddate || article.lastModified;
  if (date) {
    content.append(createTag('p', { class: 'related-articles-card-date' }, formatDate(date)));
  }

  link.append(content);

  const classes = ['related-articles-card'];
  if (index === 0) classes.push('related-articles-card-featured');
  return createTag('li', { class: classes.join(' ') }, link);
}

function renderRelatedList(block, articles, emptyMessage) {
  block.textContent = '';

  const list = createTag('ul', {
    class: 'related-articles-list',
    role: 'list',
  });
  block.append(list);

  if (!articles.length) {
    block.append(createTag('p', { class: 'related-articles-empty' }, emptyMessage));
    return;
  }
  articles.forEach((article, idx) => list.append(buildCard(article, idx)));
}

export default async function init(block) {
  const config = readBlockConfig(block);

  const authoredLinks = getAuthoredLinks(block);
  if (authoredLinks.length > 0) {
    let indexRows = [];
    try {
      indexRows = await fetchQueryIndexAll();
    } catch {
      indexRows = [];
    }
    const articles = resolveArticlesFromIndex(authoredLinks, indexRows).map((article) => {
      const row = indexRows.find(
        (r) => r?.path && normalizePath(r.path) === normalizePath(article.path),
      );
      return { ...article, keywords: row?.keywords || '' };
    });
    renderRelatedList(block, articles, 'No related articles.');
    return;
  }

  const keywords = String(config.keywords || 'random').trim();
  const excluded = String(config['excluded-keywords'] || '').trim();

  const list = createTag('ul', {
    class: 'related-articles-list',
    role: 'list',
  });
  block.textContent = '';
  block.append(list);

  try {
    const allArticles = await fetchQueryIndexAll();
    const matches = matchArticles(allArticles, keywords, excluded, RESULT_LIMIT);
    if (!matches.length) {
      block.append(createTag('p', { class: 'related-articles-empty' }, 'No related articles found.'));
      return;
    }
    matches.forEach((article, idx) => list.append(buildCard(article, idx)));
  } catch {
    block.append(createTag('p', { class: 'related-articles-empty' }, 'Unable to load related articles right now.'));
  }
}
