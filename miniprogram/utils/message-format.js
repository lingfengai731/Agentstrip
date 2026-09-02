// Safe, dependency-free formatting for AI chat replies.
// The original text remains the conversation source of truth; this module only
// turns common Markdown-shaped lines into native Mini Program display blocks.

function cleanInline(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(`{1,3}|\*\*|__|~~)/g, '')
    .replace(/(^|\s)[*_](?=\S)/g, '$1')
    .replace(/([^\s])[*_](?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldJoinWithoutSpace(left, right) {
  return /[\u2e80-\u9fff，。！？；：、（【《“‘￥]$/.test(left)
    || /^[\u2e80-\u9fff，。！？；：、（）【】《》“”‘’￥]/.test(right)
    || /\d$/.test(left) && /^(?:元|人民币|印尼盾|万|千|百|%|°)/.test(right);
}

function joinParagraph(lines) {
  return lines.reduce((result, line) => {
    const cleaned = cleanInline(line);
    if (!cleaned) return result;
    if (!result) return cleaned;
    return result + (shouldJoinWithoutSpace(result, cleaned) ? '' : ' ') + cleaned;
  }, '');
}

function formatAssistantMessage(content) {
  const lines = String(content || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .split('\n');
  const blocks = [];
  let paragraph = [];
  let inFence = false;

  const push = (type, text, marker = '') => {
    const cleaned = cleanInline(text);
    if (!cleaned) return;
    blocks.push({ id: `b${blocks.length}`, type, text: cleaned, marker });
  };
  const flushParagraph = () => {
    const text = joinParagraph(paragraph);
    paragraph = [];
    if (text) push('paragraph', text);
  };

  for (const sourceLine of lines) {
    const line = sourceLine.trim();
    if (/^```/.test(line)) {
      flushParagraph();
      inFence = !inFence;
      continue;
    }
    if (!line) {
      flushParagraph();
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      push('heading', heading[1]);
      continue;
    }

    const unordered = line.match(/^[-*+•·]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      push('list', unordered[1], '•');
      continue;
    }

    const ordered = line.match(/^(\d+)[.)、]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      push('list', ordered[2], `${ordered[1]}.`);
      continue;
    }

    const quoted = line.match(/^>\s?(.+)$/);
    if (quoted) {
      flushParagraph();
      push('quote', quoted[1]);
      continue;
    }

    if (inFence) {
      paragraph.push(line);
      continue;
    }
    paragraph.push(line);
  }

  flushParagraph();
  if (!blocks.length) push('paragraph', content || '（暂无回复）');
  return blocks;
}

module.exports = { cleanInline, formatAssistantMessage };
