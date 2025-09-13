/**
 * HTML Content Extractor
 * Extracts clean, readable content from HTML pages
 */
export class HTMLContentExtractor {
  
  /**
   * Extract readable content from HTML
   * @param {string} html - Raw HTML content
   * @param {string} url - Original URL for context
   * @returns {Object} Extracted content with metadata
   */
  extractContentFromHtml(html, url) {
    // Remove script, style, and navigation elements
    let cleanContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, ''); // Remove comments

    // Extract title
    const titleMatch = cleanContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : new URL(url).pathname;

    // Extract meta description
    const metaDescMatch = cleanContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    const description = metaDescMatch ? metaDescMatch[1] : '';

    // Convert headers to readable format with hierarchy
    cleanContent = cleanContent
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (match, level, text) => {
        const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const prefix = '#'.repeat(parseInt(level));
        return `\n\n${prefix} ${cleanText}\n\n`;
      });

    // Convert paragraphs and preserve structure
    cleanContent = cleanContent
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, text) => {
        const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return cleanText ? `${cleanText}\n\n` : '';
      });

    // Convert lists
    cleanContent = cleanContent
      .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
        const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
        const listItems = items.map(item => {
          const text = item.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          return text ? `• ${text}` : '';
        }).filter(Boolean).join('\n');
        return listItems ? `\n${listItems}\n\n` : '';
      })
      .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
        const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
        const listItems = items.map((item, index) => {
          const text = item.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          return text ? `${index + 1}. ${text}` : '';
        }).filter(Boolean).join('\n');
        return listItems ? `\n${listItems}\n\n` : '';
      });

    // Convert code blocks
    cleanContent = cleanContent
      .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => {
        const cleanCode = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"');
        return `\n\`\`\`\n${cleanCode}\n\`\`\`\n\n`;
      })
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, code) => {
        const cleanCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        return ` \`${cleanCode}\` `;
      });

    // Extract and preserve important links as markdown
    cleanContent = cleanContent
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
        const linkText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (linkText && href) {
          // Convert relative URLs to absolute
          try {
            const absoluteUrl = new URL(href, url).href;
            return ` [${linkText}](${absoluteUrl}) `;
          } catch {
            return ` [${linkText}](${href}) `;
          }
        }
        return linkText || '';
      });

    // Remove remaining HTML tags
    cleanContent = cleanContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[a-zA-Z0-9#]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    return {
      title,
      content: cleanContent,
      metadata: {
        description,
        originalUrl: url,
        contentLength: cleanContent.length,
        hasCodeBlocks: /```/.test(cleanContent),
        hasLinks: /\[.*\]\(.*\)/.test(cleanContent)
      }
    };
  }
}
