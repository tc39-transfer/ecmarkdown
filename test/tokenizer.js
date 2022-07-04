'use strict';
const assert = require('assert');
const Tokenizer = require('../dist/tokenizer.js').Tokenizer;
const formats = {
  star: '*',
  underscore: '_',
  pipe: '|',
  tick: '`',
  tilde: '~',
};

function assertTok(tok, name, contents, location) {
  assert.equal(tok.name, name);
  assert.equal(tok.contents, contents);
  if (location) {
    assert.deepEqual(tok.location, location);
  }
}

describe('Tokenizer#peek', function () {
  let t;

  beforeEach(function () {
    t = new Tokenizer('a *b* c');
  });

  it('should return the next token', function () {
    assertTok(t.peek(), 'text', 'a');
  });

  it('should return later tokens when given an offset', function () {
    assertTok(t.peek(2), 'whitespace', ' ');
  });

  it('should not consume tokens', function () {
    assertTok(t.peek(2), 'whitespace', ' ');
    assertTok(t.peek(1), 'text', 'a');
  });

  it('should handle skipping buffering tokens', function () {
    assertTok(t.peek(2), 'whitespace', ' ');
    assertTok(t.peek(3), 'star', '*');
    assertTok(t.peek(), 'text', 'a');
  });

  it('should handle EOF properly', function () {
    assertTok(t.peek(7), 'text', 'c');
    assertTok(t.peek(8), 'EOF');
    assertTok(t.peek(9), 'EOF');
    assertTok(t.peek(10), 'EOF');
  });
});

describe('Tokenizer#next', function () {
  it('should handle EOF properly', function () {
    const t = new Tokenizer('a b');
    assertTok(t.next(), 'text', 'a');
    assertTok(t.next(), 'whitespace', ' ');
    assertTok(t.next(), 'text', 'b');
    assertTok(t.next(), 'EOF');
    assertTok(t.next(), 'EOF');
    assertTok(t.next(), 'EOF');
    assertTok(t.next(), 'EOF');
  });
});

function testBasicToken(name, token) {
  describe(name, function () {
    it('is scanned properly at the start', function () {
      const t = new Tokenizer(token + 'b');
      assertTok(t.next(), name, token);
      assertTok(t.next(), 'text', 'b');
      assertTok(t.next(), 'EOF');
    });

    it('is scanned properly after whitespace', function () {
      const t = new Tokenizer(' ' + token);
      assertTok(t.next(), 'whitespace', ' ');
      assertTok(t.next(), name, token);
      assertTok(t.next(), 'EOF');
    });

    it('is scanned properly after text', function () {
      const t = new Tokenizer('b' + token);
      assertTok(t.next(), 'text', 'b');
      assertTok(t.next(), name, token);
      assertTok(t.next(), 'EOF');
    });

    if (token === '\n' || token === '\n\n') {
      it('is scanned properly after a newline', function () {
        const t = new Tokenizer('\n' + token);
        assertTok(t.next(), 'parabreak', '\n' + token);
        assertTok(t.next(), 'EOF');
      });

      it('is scanned properly after two newlines', function () {
        const t = new Tokenizer('\n\n' + token);
        assertTok(t.next(), 'parabreak', '\n\n' + token);
        assertTok(t.next(), 'EOF');
      });
    } else {
      it('is scanned properly after linebreak', function () {
        const t = new Tokenizer('\n' + token);
        assertTok(t.next(), 'linebreak', '\n');
        assertTok(t.next(), name, token);
        assertTok(t.next(), 'EOF');
      });

      it('is scanned properly after parabreak', function () {
        const t = new Tokenizer('\n\n' + token);
        assertTok(t.next(), 'parabreak', '\n\n');
        assertTok(t.next(), name, token);
        assertTok(t.next(), 'EOF');
      });
    }
  });
}

describe('Token:', function () {
  Object.keys(formats).forEach(function (name) {
    testBasicToken(name, formats[name]);
  });
  testBasicToken('linebreak', '\n');
  testBasicToken('parabreak', '\n\n');

  describe('linebreak', function () {
    // TODO: Fix this
    it('does not consider \\r a linebreak', function () {
      const t = new Tokenizer('\r\nfoo');
      assertTok(t.next(), 'text', '\r');
      assertTok(t.next(), 'linebreak', '\n');
    });
  });

  describe('numbered list', function () {
    it('considers a list at the start of the string a list', function () {
      const t = new Tokenizer('1. foo');
      assertTok(t.next(), 'ol', '1. ');
      assertTok(t.next(), 'text', 'foo');
    });

    it('does not consider a list in the middle of the string a list', function () {
      const t = new Tokenizer('foo 1. foo');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'whitespace', ' ');
      assertTok(t.next(), 'text', '1.');
      assertTok(t.next(), 'whitespace', ' ');
      assertTok(t.next(), 'text', 'foo');
    });

    // note that this will not parse as a list but the lexer considers it one
    // since it doesn't know if we're in a paragraph or a list.
    it('considers a list after a newline a list', function () {
      const t = new Tokenizer('foo\n1. foo');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'linebreak', '\n');
      assertTok(t.next(), 'ol', '1. ');
      assertTok(t.next(), 'text', 'foo');
    });

    it('considers a list after a parabreak a list', function () {
      const t = new Tokenizer('foo\n\n1. foo');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'parabreak', '\n\n');
      assertTok(t.next(), 'ol', '1. ');
      assertTok(t.next(), 'text', 'foo');
    });

    it('does not consider a number without a dot a list', function () {
      const t = new Tokenizer('1 foo');
      assertTok(t.next(), 'text', '1');
      assertTok(t.next(), 'whitespace', ' ');
      assertTok(t.next(), 'text', 'foo');
    });

    it('does not consider a number and a dot without a trailing space a list', function () {
      const t = new Tokenizer('1.foo');
      assertTok(t.next(), 'text', '1.foo');
    });

    it('handles preceding whitespace', function () {
      const t = new Tokenizer(' \t 1. foo');
      assertTok(t.next(), 'ol', ' \t 1. ');
      assertTok(t.next(), 'text', 'foo');
    });
  });

  describe('bulleted list', function () {
    it('considers a list at the start of the string a list', function () {
      const t = new Tokenizer('* foo');
      assertTok(t.next(), 'ul', '* ');
      assertTok(t.next(), 'text', 'foo');
    });

    it('does not consider a list in the middle of the string a list', function () {
      const t = new Tokenizer('foo * foo');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'whitespace', ' ');
      assertTok(t.next(), 'star', '*');
      assertTok(t.next(), 'whitespace', ' ');
      assertTok(t.next(), 'text', 'foo');
    });

    // note that this will not parse as a list but the lexer considers it one
    // since it doesn't know if we're in a paragraph or a list.
    it('considers a list after a newline a list', function () {
      const t = new Tokenizer('foo\n* foo');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'linebreak', '\n');
      assertTok(t.next(), 'ul', '* ');
      assertTok(t.next(), 'text', 'foo');
    });

    it('considers a list after a parabreak a list', function () {
      const t = new Tokenizer('foo\n\n* foo');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'parabreak', '\n\n');
      assertTok(t.next(), 'ul', '* ');
      assertTok(t.next(), 'text', 'foo');
    });

    it('does not consider a star without a trailing space a list', function () {
      const t = new Tokenizer('*foo');
      assertTok(t.next(), 'star', '*');
      assertTok(t.next(), 'text', 'foo');
    });

    it('handles preceding whitespace', function () {
      const t = new Tokenizer(' \t * foo');
      assertTok(t.next(), 'ul', ' \t * ');
      assertTok(t.next(), 'text', 'foo');
    });
  });

  describe('HTML comments', function () {
    // this appears to be a deviation from GMD but seems like a good idea.
    it('allows block comments', function () {
      const t = new Tokenizer('<!--\n-->foo');
      assertTok(t.next(), 'comment', '<!--\n-->');
      assertTok(t.next(), 'text', 'foo');
    });

    it('can follow characters', function () {
      const t = new Tokenizer('foo<!--\n-->foo');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'comment', '<!--\n-->');
      assertTok(t.next(), 'text', 'foo');
    });

    it('need the closing tag', function () {
      const t = new Tokenizer('foo<!-- --foo');
      assertTok(t.next(), 'text', 'foo<!--');
      assertTok(t.next(), 'whitespace', ' ');
      assertTok(t.next(), 'text', '--foo');
    });

    it('is not greedy', function () {
      const t = new Tokenizer('foo<!-- -->bar<!-- -->baz');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'comment', '<!-- -->');
      assertTok(t.next(), 'text', 'bar');
      assertTok(t.next(), 'comment', '<!-- -->');
      assertTok(t.next(), 'text', 'baz');
    });

    it('handles only block tags', function () {
      const t = new Tokenizer('<emu-clause>');
      assertTok(t.next(), 'tag', '<emu-clause>');
      assertTok(t.next(), 'EOF');
    });
  });

  describe('HTML tags', function () {
    it('allows linebreak', function () {
      const t = new Tokenizer('<p\n>xxx\nfoo</p>');
      assertTok(t.next(), 'tag', '<p\n>');
      assertTok(t.next(), 'text', 'xxx');
      assertTok(t.next(), 'linebreak', '\n');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'tag', '</p>');
    });

    it('can follow characters', function () {
      const t = new Tokenizer('foo<br>foo');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'tag', '<br>');
      assertTok(t.next(), 'text', 'foo');
    });

    it('need the closing angle bracket', function () {
      const t = new Tokenizer('foo<br foo');
      assertTok(t.next(), 'text', 'foo<br');
      assertTok(t.next(), 'whitespace', ' ');
      assertTok(t.next(), 'text', 'foo');

      const t2 = new Tokenizer('<br foo');
      assertTok(t2.next(), 'text', '<br');
      assertTok(t2.next(), 'whitespace', ' ');
      assertTok(t2.next(), 'text', 'foo');
    });

    it('does not recognize invalid tags', function () {
      const invalidTags = [
        '< startwithspace>',
        '<withGarbage ->',
        '<needs whitespace="true"after attributes>',
        '<unclosed attribute="foo>',
        '<tag attr=>',
      ];

      invalidTags.forEach(function (tag) {
        const t = new Tokenizer(tag);
        const tok = t.next();
        assert(tok.name !== 'tag', 'should not parse ' + tag + ' as tag');
      });
    });

    it('recognizes valid tags', function () {
      const validTags = [
        '<tag with spaces ok>',
        '<tag    >',
        '<tag attr=blah!blah attr2>',
        '<tag attr=">">',
        '<tag attr="\'">',
        "<tag attr='foo'>",
        "<tag dashed-attr='foo'>",
      ];

      validTags.forEach(function (tag) {
        const t = new Tokenizer(tag);
        const tok = t.next();
        assert(tok.name === 'tag', 'should parse ' + tag + ' as tag');
      });
    });

    it('understands opaque tags', function () {
      const t = new Tokenizer('bar\n<emu-grammar>\n`foo`\n</emu-syntax>');
      assertTok(t.next(), 'text', 'bar');
      assertTok(t.next(), 'linebreak', '\n');
      assertTok(t.next(), 'opaqueTag', '<emu-grammar>\n`foo`\n</emu-syntax>');
      assertTok(t.next(), 'EOF');
    });

    it('understands block tags', function () {
      const t = new Tokenizer('bar\n<emu-note>\nfoo\n</emu-note>');
      assertTok(t.next(), 'text', 'bar');
      assertTok(t.next(), 'linebreak', '\n');
      assertTok(t.next(), 'tag', '<emu-note>');
      assertTok(t.next(), 'linebreak', '\n');
      assertTok(t.next(), 'text', 'foo');
      assertTok(t.next(), 'linebreak', '\n');
      assertTok(t.next(), 'tag', '</emu-note>');
    });
  });
});

function testEscapeFormat(name, token) {
  it('escapes start ' + name, function () {
    const t = new Tokenizer('\\' + token + 'a' + token);
    assertTok(t.next(), 'text', token + 'a');
    assertTok(t.next(), name, token);
    assertTok(t.next(), 'EOF');
  });

  it('escapes end ' + name, function () {
    const t = new Tokenizer(token + 'a\\' + token);
    assertTok(t.next(), name, token);
    assertTok(t.next(), 'text', 'a' + token);
    assertTok(t.next(), 'EOF');
  });
}

describe('backslash escapes', function () {
  it('considers one backslash text', function () {
    const t = new Tokenizer('\\');
    assertTok(t.next(), 'text', '\\');
    assertTok(t.next(), 'EOF');
  });

  it('considers trailing backslash text', function () {
    const t = new Tokenizer('a\\');
    assertTok(t.next(), 'text', 'a\\');
    assertTok(t.next(), 'EOF');
  });

  it('considers two backslashes a backslash', function () {
    const t = new Tokenizer('\\\\a');
    assertTok(t.next(), 'text', '\\a');
    assertTok(t.next(), 'EOF');
  });

  Object.keys(formats).forEach(function (name) {
    testEscapeFormat(name, formats[name]);
  });

  it('escapes html tags', function () {
    const t = new Tokenizer('\\<div>hello</div>');
    assertTok(t.next(), 'text', '<div>hello');
    assertTok(t.next(), 'tag', '</div>');
    assertTok(t.next(), 'EOF');
  });

  it('escapes html comments', function () {
    const t = new Tokenizer('\\<!--hello-->');
    assertTok(t.next(), 'text', '<!--hello-->');
    assertTok(t.next(), 'EOF');
  });

  it('does not escape non-format characters', function () {
    const t = new Tokenizer('\\a');
    assertTok(t.next(), 'text', '\\a');
    assertTok(t.next(), 'EOF');
  });
});

describe('Tokenizer', function () {
  it('tracks positions', function () {
    const t = new Tokenizer('1. foo');
    assertTok(t.next(), 'ol', '1. ', {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 4, offset: 3 },
    });
    assertTok(t.next(), 'text', 'foo', {
      start: { line: 1, column: 4, offset: 3 },
      end: { line: 1, column: 7, offset: 6 },
    });
  });
});
