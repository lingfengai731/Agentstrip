import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'wandermind-studio', 'frontend');

function read(file) {
  return fs.readFileSync(path.join(frontend, file), 'utf8');
}

function expect(file, pattern, message) {
  if (!pattern.test(read(file))) throw new Error(`${file}: ${message}`);
}

expect('reset-password.html', /<meta\s+name="robots"\s+content="noindex,nofollow">/i, 'password reset page must not be indexed');
expect('shared.html', /<meta\s+name="robots"\s+content="noindex,nofollow">/i, 'tokenized shared trips must not be indexed');
expect('search.html', /<meta\s+name="robots"\s+content="noindex,follow">/i, 'internal search results must not be indexed');
expect('ai-tool.html', /WanderMind AI trip workspace[\s\S]*Six specialist agents[\s\S]*supplier details before booking/i, 'AI workspace needs crawlable product context');

for (const file of ['index.html', 'bali.html', 'ai-tool.html', 'about.html', 'services.html', 'find-driver.html', 'contact.html', 'privacy.html']) {
  if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(read(file))) {
    throw new Error(`${file}: public sitemap page must remain indexable`);
  }
}

console.log('SEO index controls passed: public pages indexable; utility and private pages protected');
