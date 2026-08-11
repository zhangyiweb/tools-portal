import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const docsPagesDir = path.join(repoRoot, 'docs', 'pages');

const corePages = [
  'BufferAttribute.html',
  'BufferGeometry.html',
  'Clock.html',
  'EventDispatcher.html',
  'Float16BufferAttribute.html',
  'Float32BufferAttribute.html',
  'GLBufferAttribute.html',
  'InstancedBufferAttribute.html',
  'InstancedBufferGeometry.html',
  'InstancedInterleavedBuffer.html',
  'Int16BufferAttribute.html',
  'Int32BufferAttribute.html',
  'Int8BufferAttribute.html',
  'InterleavedBuffer.html',
  'InterleavedBufferAttribute.html',
  'Layers.html',
  'Object3D.html',
  'Raycaster.html',
  'RenderTarget.html',
  'RenderTarget3D.html',
  'Timer.html',
  'Uint16BufferAttribute.html',
  'Uint32BufferAttribute.html',
  'Uint8BufferAttribute.html',
  'Uint8ClampedBufferAttribute.html',
  'Uniform.html',
  'UniformsGroup.html',
];

/**
 * 仅做“固定术语与结构标签”的批量中文化：
 * - 不尝试完整机器翻译长段落（那会引入大量不确定性）
 * - 不改动 translate="no" 标记的内容
 * - 不改动代码块、API 名称、类型名、链接 URL
 */
function localizeFixedPhrases(html, className) {
  let out = html;

  // lang + title
  out = out.replace(/<html\s+lang="en">/g, '<html lang="zh">');
  out = out.replace(
    /<title>[^<]*? - Three\.js Docs<\/title>/g,
    `<title>${className} - Three.js 文档</title>`,
  );

  // 常见章节标题（不在 translate="no" 的节点上）
  out = out.replace(/<h2>\s*Constructor\s*<\/h2>/g, '<h2>构造函数</h2>');
  out = out.replace(/<h2 class="subsection-title">\s*Properties\s*<\/h2>/g, '<h2 class="subsection-title">属性</h2>');
  out = out.replace(/<h2 class="subsection-title">\s*Methods\s*<\/h2>/g, '<h2 class="subsection-title">方法</h2>');
  out = out.replace(/<h2 class="subsection-title">\s*Static Methods\s*<\/h2>/g, '<h2 class="subsection-title">静态方法</h2>');
  out = out.replace(/<h2 class="subsection-title">\s*Source\s*<\/h2>/g, '<h2 class="subsection-title">源码</h2>');
  out = out.replace(/<h2 class="subsection-title">\s*Import\s*<\/h2>/g, '<h2 class="subsection-title">导入</h2>');

  // Code Example
  out = out.replace(/<h2>\s*Code Example\s*<\/h2>/g, '<h2>代码示例</h2>');

  // dt labels
  out = out.replace(/<dt class="tag-returns"><strong>Returns:<\/strong>/g, '<dt class="tag-returns"><strong>返回值：</strong>');
  out = out.replace(/<dt class="tag-overrides"><strong>Overrides:<\/strong>/g, '<dt class="tag-overrides"><strong>重写：</strong>');

  // Default is
  out = out.replace(/<p>Default is <code>/g, '<p>默认值为 <code>');

  // Note:
  out = out.replace(/<p>Note:\s*/g, '<p>注意：');
  out = out.replace(/<p>Note\s*:/g, '<p>注意：');

  return out;
}

function main() {
  const results = [];

  for (const filename of corePages) {
    const fullPath = path.join(docsPagesDir, filename);
    if (!fs.existsSync(fullPath)) {
      results.push({ file: filename, status: 'missing' });
      continue;
    }

    const before = fs.readFileSync(fullPath, 'utf8');
    const className = path.basename(filename, '.html');
    const after = localizeFixedPhrases(before, className);

    if (after !== before) {
      fs.writeFileSync(fullPath, after, 'utf8');
      results.push({ file: filename, status: 'updated' });
    } else {
      results.push({ file: filename, status: 'unchanged' });
    }
  }

  const updated = results.filter((r) => r.status === 'updated').map((r) => r.file);
  const missing = results.filter((r) => r.status === 'missing').map((r) => r.file);
  console.log(JSON.stringify({ updated, missing, total: results.length }, null, 2));
}

main();

