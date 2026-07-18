'use strict'

const neostandard = require('neostandard')

module.exports = [
  ...neostandard({}),
  {
    rules: {
      // async executors are used deliberately in a few places in this codebase
      'no-async-promise-executor': 'off',
      // downgraded from error — several switch statements rely on lexical
      // declarations inside case blocks
      'no-case-declarations': 'warn',
      // enforce a maximum number of parameters in function definitions
      'max-params': ['warn', { max: 6 }],
      // don't require/forbid a space before the parens on function definitions
      '@stylistic/space-before-function-paren': ['error', {
        anonymous: 'ignore',
        named: 'ignore',
        asyncArrow: 'ignore'
      }],
      // hard ceilings, not targets — see docs/CODING_STANDARDS.md
      'max-lines-per-function': ['error', { max: 3000 }],
      'max-lines': ['error', { max: 3000 }]
    }
  }
]
