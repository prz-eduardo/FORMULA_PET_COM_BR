const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src', 'app', 'pages', 'carrinho', 'carrinho.component.html');
const s = fs.readFileSync(p,'utf8');
const lines = s.split(/\r?\n/);
const re = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
let stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    const full = m[0];
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const isClosing = full.startsWith('</');
    const isSelfClose = /\/\s*>$/.test(full) || voids.has(tag);
    if (isSelfClose) continue;
    if (!isClosing) {
      stack.push({ tag, line: i + 1, text: line.trim() });
    } else {
      if (stack.length === 0) {
        console.log('Unexpected closing tag "' + tag + '" at line', i + 1);
        process.exit(0);
      }
      const top = stack[stack.length - 1];
      if (top.tag === tag) {
        stack.pop();
      } else {
        console.log('Mismatched closing tag "' + tag + '" at line', i + 1, 'but top of stack is "' + top.tag + '" opened at line', top.line);
        console.log('Current stack (top last):');
        console.log(stack.map(x => x.tag + '(line:' + x.line + ')').slice(-10).join(' > '));
        console.log('Context lines:');
        const start = Math.max(0, i - 6);
        const end = Math.min(lines.length - 1, i + 6);
        for (let j = start; j <= end; j++) {
          console.log((j + 1) + '\t' + lines[j]);
        }
        process.exit(0);
      }
    }
  }
}
if (stack.length > 0) {
  console.log('Unclosed tags at end of file:', stack.map(x => x.tag + '(line:' + x.line + ')').join(', '));
  process.exit(0);
}
console.log('All tags nested correctly');
