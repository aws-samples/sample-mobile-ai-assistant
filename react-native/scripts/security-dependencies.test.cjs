const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const queryString = require('query-string');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

test('navigation query parsing supports Unicode, spaces and repeated keys', () => {
  const parsed = queryString.parse(
    'name=%E4%BD%A0%E5%A5%BD&message=hello+world&tag=one&tag=two'
  );

  assert.deepEqual(
    { ...parsed },
    {
      message: 'hello world',
      name: '你好',
      tag: ['one', 'two'],
    }
  );
});

test('navigation query parameters survive a stringify/parse round trip', () => {
  const params = { chat: '会话/1', prompt: 'a+b & c=d', empty: '' };

  assert.deepEqual(
    { ...queryString.parse(queryString.stringify(params)) },
    params
  );
});

test('navigation query parsing tolerates malformed UTF-8', () => {
  const parsed = queryString.parse('value=%E0%A4%A&valid=%E2%9C%93');

  assert.equal(parsed.valid, '✓');
  assert.equal(typeof parsed.value, 'string');
});

test('malformed percent-encoded input completes within a bounded time', () => {
  const result = spawnSync(
    process.execPath,
    ['-e', "require('query-string').parse('value=' + '%E0%A4'.repeat(10000))"],
    { cwd: __dirname, timeout: 5000, encoding: 'utf8' }
  );

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test('XML parsing and serialization preserve MathML', () => {
  const source =
    '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
  const document = new DOMParser().parseFromString(source, 'application/xml');

  assert.equal(document.documentElement.localName, 'math');
  assert.equal(new XMLSerializer().serializeToString(document), source);
});

test('well-formed XML serialization rejects injected element and attribute names', () => {
  const document = new DOMParser().parseFromString(
    '<root/>',
    'application/xml'
  );
  const serializer = new XMLSerializer();
  const options = { requireWellFormed: true };
  const injectedElement = document.createElement('item\n><injected');

  assert.throws(() => serializer.serializeToString(injectedElement, options));
  document.documentElement.setAttribute('attr\nname', 'value');
  assert.throws(() => serializer.serializeToString(document, options));
});

test('MathJax renders formulas with the updated XML dependency', () => {
  const { mathjax } = require('mathjax-full/js/mathjax.js');
  const { TeX } = require('mathjax-full/js/input/tex.js');
  const { SVG } = require('mathjax-full/js/output/svg.js');
  const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
  const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
  const adaptor = liteAdaptor();
  const handler = RegisterHTMLHandler(adaptor);

  try {
    const document = mathjax.document('', {
      InputJax: new TeX(),
      OutputJax: new SVG({ fontCache: 'none' }),
    });
    const result = adaptor.outerHTML(document.convert('x^2 + y^2 = z^2'));

    assert.match(result, /<svg/);
    assert.match(result, /<path/);
  } finally {
    mathjax.handlers.unregister(handler);
  }
});
