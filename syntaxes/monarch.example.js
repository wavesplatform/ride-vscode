obj = {
    tokenPostfix: '.',
    tokenizer: {
      root: [
        { regex: /base58'/, action: { token: 'literal', bracket: '@open', next: '@literal' } },
        { include: '@whitespace' },
        {
          regex: /[a-z_$][\w$]*/, action: {
            cases: {
              '@keywords': 'keyword'
            }
          }
        },
        { regex: /"([^"\\]|\\.)*$/, action: { token: 'string.invalid' } },
        { regex: /"/, action: { token: 'string.quote', bracket: '@open', next: '@string' } },
      ],
      whitespace: [
        //{ regex: /^[ \t\v\f]*#\w.*$/, action: { token: 'namespace.cpp' } },
        { regex: /[ \t\v\f\r\n]+/, action: { token: 'white' } },
        //{ regex: /\/\*/, action: { token: 'comment', next: '@comment' } },
        { regex: /#.*$/, action: { token: 'comment' } },
      ],
      literal: [
        { regex: /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+/, action: { token: 'literal' } },
        { regex: /'/, action: { token: 'literal', bracket: '@close', next: '@pop' } }
      ],
      string: [
        { regex: /[^\\"]+/, action: { token: 'string' } },
        { regex: /"/, action: { token: 'string.quote', bracket: '@close', next: '@pop' } }
      ],
      // comment: [
      //   [/[^\/*]+/, 'comment' ],
      //   [/\/\*/,    'comment', '@push' ],    // nested comment
      //   ["\\*/",    'comment', '@pop'  ],
      //   [/[\/*]/,   'comment' ]
      // ],
      // comment: [
      //   { regex: /./gm, action: { token: 'comment' } },
      //   { regex: /.$/gm, action: { token: 'comment.quote', bracket: '@close', next: '@pop' } }
      // ],
    }
  }