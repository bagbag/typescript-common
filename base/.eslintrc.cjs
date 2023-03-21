module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    worker: true
  },
  extends: [
    'eslint:all',
    'plugin:@typescript-eslint/all',
    'plugin:import/recommended',
    'plugin:import/typescript'
  ],
  settings: {
    'import/resolver': {
      typescript: true
    }
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: 'tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    /** angular */
    '@angular-eslint/template/eqeqeq': 'off',

    /** typescript */
    '@typescript-eslint/brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
    '@typescript-eslint/consistent-type-definitions': 'off',
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/init-declarations': 'off',
    '@typescript-eslint/lines-around-comment': 'off',
    '@typescript-eslint/lines-between-class-members': ['warn', 'always', { exceptAfterSingleLine: true }],
    '@typescript-eslint/method-signature-style': 'off',
    '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true, ignoreVoidOperator: true }],
    '@typescript-eslint/no-empty-interface': ['warn', { 'allowSingleExtends': true }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-extra-parens': 'off',
    '@typescript-eslint/no-extraneous-class': 'off',
    '@typescript-eslint/no-inferrable-types': ['warn', { ignoreParameters: true, ignoreProperties: true }],
    '@typescript-eslint/no-invalid-void-type': 'off',
    '@typescript-eslint/no-magic-numbers': ['off', { ignoreNumericLiteralTypes: true, ignoreEnums: true, ignore: [0, 1, 128, 256, 512, 1024, 2048, 4096], ignoreArrayIndexes: true }],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-restricted-imports': 'off',
    '@typescript-eslint/no-type-alias': 'off',
    '@typescript-eslint/no-unnecessary-condition': ['error', { allowConstantLoopConditions: true }],
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unused-vars-experimental': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
    '@typescript-eslint/no-useless-constructor': 'off',
    '@typescript-eslint/object-curly-spacing': 'off',
    '@typescript-eslint/prefer-readonly-parameter-types': ['off', { checkParameterProperties: false }],
    '@typescript-eslint/quotes': ['warn', 'single'],
    '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true, allowNullish: true }],
    '@typescript-eslint/sort-type-constituents': 'off',
    '@typescript-eslint/sort-type-union-intersection-members': 'off',
    '@typescript-eslint/space-before-function-paren': ['warn', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
    '@typescript-eslint/typedef': 'off',

    /** import */
    'import/no-duplicates': ['warn', { 'prefer-inline': true }],
    'import/no-cycle': ['off', { ignoreExternal: true }],
    'import/no-self-import': ['error'],
    'import/no-extraneous-dependencies': ['error', { devDependencies: false, includeTypes: true }],
    'import/no-empty-named-blocks': ['error'],
    'import/no-mutable-exports': ['error'],
    'import/no-nodejs-modules': ['error'],
    'import/no-absolute-path': ['error'],
    'import/no-useless-path-segments': ['warn'],
    'import/consistent-type-specifier-style': ['off', 'prefer-inline'],
    'import/newline-after-import': ['warn', { considerComments: true }],
    'import/no-anonymous-default-export': ['error'],
    'import/no-named-default': ['error'],
    'import/no-unassigned-import': ['error'],

    /** misc */
    'array-bracket-newline': ['error', 'consistent'],
    'array-element-newline': ['error', 'consistent'],
    'camelcase': 'off',
    'capitalized-comments': 'off',
    'class-methods-use-this': 'off',
    'complexity': 'off',
    'dot-location': ['error', 'property'],
    'eqeqeq': 'off',
    'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
    'function-call-argument-newline': ['warn', 'consistent'],
    'function-paren-newline': ['warn', 'consistent'],
    'generator-star-spacing': ['off', { before: false, after: true }],
    'id-length': 'off',
    'indent': 'off',
    'init-declarations': 'off',
    'line-comment-position': 'off',
    'linebreak-style': ['error', 'unix'],
    'lines-around-comment': 'off',
    'lines-between-class-members': 'off',
    'max-classes-per-file': 'off',
    'max-len': ['off', { code: 150 }],
    'max-lines-per-function': ['off', { 'max': 100, 'skipBlankLines': true, 'skipComments': true }],
    'max-lines': 'off',
    'max-params': 'off',
    'max-statements': 'off',
    'multiline-ternary': 'off',
    'new-cap': 'off',
    'newline-per-chained-call': 'off',
    'no-await-in-loop': 'off',
    'no-case-declarations': 'off',
    'no-constant-condition': 'off',
    'no-continue': 'off',
    'no-duplicate-imports': 'off',
    'no-inline-comments': 'off',
    'no-negated-condition': 'off',
    'no-nested-ternary': 'off',
    'no-plusplus': ['off', { allowForLoopAfterthoughts: true }],
    'no-promise-executor-return': 'off',
    'no-restricted-imports': 'off',
    'no-ternary': 'off',
    'no-undefined': 'off',
    'no-underscore-dangle': 'off',
    'no-void': 'off',
    'object-curly-spacing': 'off',
    'object-property-newline': ['warn', { allowAllPropertiesOnSameLine: true }],
    'one-var': ['error', 'never'],
    'operator-linebreak': ['warn', 'before'],
    'padded-blocks': ['error', 'never'],
    'prefer-arrow/prefer-arrow-functions': 'off',
    'prefer-destructuring': 'off',
    'prefer-named-capture-group': 'off',
    'quote-props': ['error', 'as-needed'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'sort-imports': ['off', { ignoreCase: true }],
    'sort-keys': 'off',

    '@typescript-eslint/naming-convention': [
      'warn',
      {
        selector: 'default',
        format: ['camelCase'],
        leadingUnderscore: 'allowSingleOrDouble'
      },
      {
        selector: 'enumMember',
        format: ['PascalCase']
      },
      {
        selector: 'typeLike',
        format: ['PascalCase']
      }
    ],
    '@typescript-eslint/member-delimiter-style': ['error', {
      multiline: {
        delimiter: 'comma',
        requireLast: false
      },
      singleline: {
        delimiter: 'comma',
        requireLast: false
      },
      overrides: {
        interface: {
          multiline: {
            delimiter: 'semi',
            requireLast: true
          }
        }
      }
    }],
    '@typescript-eslint/member-ordering': ['warn', {
      default: [
        // Index signature
        'signature',
        'call-signature',

        // Fields
        '#private-static-field',
        'private-static-field',
        'protected-static-field',
        'public-static-field',

        /*
        'private-decorated-field',
        'protected-decorated-field',
        'public-decorated-field',
        */

        '#private-instance-field',
        'private-instance-field',
        'protected-instance-field',
        'public-instance-field',

        'protected-abstract-field',
        'public-abstract-field',

        '#private-field',
        'private-field',
        'protected-field',
        'public-field',

        'static-field',
        'instance-field',
        'abstract-field',

        // 'decorated-field',

        'field',

        // Getters
        '#private-static-get',
        'private-static-get',
        'protected-static-get',
        'public-static-get',

        /*
        'private-decorated-get',
        'protected-decorated-get',
        'public-decorated-get',
        */

        '#private-instance-get',
        'private-instance-get',
        'protected-instance-get',
        'public-instance-get',

        'protected-abstract-get',
        'public-abstract-get',

        '#private-get',
        'private-get',
        'protected-get',
        'public-get',

        'static-get',
        'instance-get',
        'abstract-get',

        // 'decorated-get',

        'get',

        // Setters
        '#private-static-set',
        'private-static-set',
        'protected-static-set',
        'public-static-set',

        /*
        'private-decorated-set',
        'protected-decorated-set',
        'public-decorated-set',
        */

        '#private-instance-set',
        'private-instance-set',
        'protected-instance-set',
        'public-instance-set',

        'protected-abstract-set',
        'public-abstract-set',

        '#private-set',
        'private-set',
        'protected-set',
        'public-set',

        'static-set',
        'instance-set',
        'abstract-set',

        // 'decorated-set',

        'set',

        // Static initialization
        'static-initialization',

        // Constructors
        'public-constructor',
        'protected-constructor',
        'private-constructor',

        'constructor',

        // Methods
        'public-static-method',
        'protected-static-method',
        'private-static-method',
        '#private-static-method',

        /*
        'public-decorated-method',
        'protected-decorated-method',
        'private-decorated-method',
        */

        'public-instance-method',
        'protected-instance-method',
        'private-instance-method',
        '#private-instance-method',

        'public-abstract-method',
        'protected-abstract-method',

        'public-method',
        'protected-method',
        'private-method',
        '#private-method',

        'static-method',
        'instance-method',
        'abstract-method',

        // 'decorated-method',

        'method'
      ]
    }]
  }
}
