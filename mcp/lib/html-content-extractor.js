/**
 * HTML Content Extractor
 * Extracts clean, readable content from HTML pages
 */
import cheerio from 'cheerio';

export class HTMLContentExtractor {
  /**
   * Extract readable content from HTML
   * @param {string} html - Raw HTML content
   * @param {string} url - Original URL for context
   * @returns {Object} Extracted content with metadata
   */
  extractContentFromHtml(html, url) {
    const $ = this._load(html);
    this._removeNoise($);
    const title = this._extractTitle($, url);
    const description = this._extractDescription($);
    this._convertHeaders($);
    this._convertParagraphs($);
    this._convertLists($);
    this._convertCodeBlocks($);
    this._convertLinks($, url);
    const content = this._collectText($);

    return {
      title,
      content,
      metadata: {
        description,
        originalUrl: url,
        contentLength: content.length,
        hasCodeBlocks: /```/.test(content),
        hasLinks: /\[.*\]\(.*\)/.test(content)
      }
    };
  }

  _load(html) {
    return cheerio.load(html);
  }

  _removeNoise($) {
    $('script, style, nav, header, footer').remove();
    $('*')
      .contents()
      .each((_, el) => {
        if (el.type === 'comment') $(el).remove();
      });
  }

  _extractTitle($, url) {
    const title = $('title').first().text().trim();
    return title || new URL(url).pathname;
  }

  _extractDescription($) {
    return $('meta[name="description"]').attr('content') || '';
  }

  _convertHeaders($) {
    $('h1,h2,h3,h4,h5,h6').each((_, el) => {
      const level = parseInt(el.tagName.substring(1));
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      $(el).replaceWith(`\n\n${'#'.repeat(level)} ${text}\n\n`);
    });
  }

  _convertParagraphs($) {
    $('p').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      $(el).replaceWith(text ? `${text}\n\n` : '');
    });
  }

  _convertLists($) {
    $('ul').each((_, ul) => {
      const items = $(ul)
        .children('li')
        .map((i, li) => {
          const text = $(li).text().replace(/\s+/g, ' ').trim();
          return text ? `• ${text}` : '';
        })
        .get()
        .filter(Boolean)
        .join('\n');
      $(ul).replaceWith(items ? `\n${items}\n\n` : '');
    });
    $('ol').each((_, ol) => {
      const items = $(ol)
        .children('li')
        .map((i, li) => {
          const text = $(li).text().replace(/\s+/g, ' ').trim();
          return text ? `${i + 1}. ${text}` : '';
        })
        .get()
        .filter(Boolean)
        .join('\n');
      $(ol).replaceWith(items ? `\n${items}\n\n` : '');
    });
  }

  _convertCodeBlocks($) {
    $('pre code').each((_, el) => {
      const code = this._decodeEntities($(el).html() || '');
      $(el).parent().replaceWith(`\n\`\`\`\n${code}\n\`\`\`\n\n`);
    });
    $('code').each((_, el) => {
      if ($(el).parent().is('pre')) return;
      const code = this._decodeEntities($(el).html() || '');
      $(el).replaceWith(` \`${code}\` `);
    });
  }

  _convertLinks($, url) {
    $('a').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const href = $(el).attr('href');
      if (text && href) {
        let absolute;
        try {
          absolute = new URL(href, url).href;
        } catch {
          absolute = href;
        }
        $(el).replaceWith(` [${text}](${absolute}) `);
      } else {
        $(el).replaceWith(text);
      }
    });
  }

  _collectText($) {
    return $.root()
      .text()
      .replace(/\u00a0/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  _decodeEntities(text) {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');
  }
}
