import tseslint from 'typescript-eslint';
export const scope = ['_extensions/course-core/', '_extensions/course-navigation/', '_extensions/course-presentation/'];
export const structuralScope = ['_extensions/course-core/domain/**/*.ts', '_extensions/course-core/contracts/**/*.ts', '_extensions/course-core/document/native-ast.ts', '_extensions/course-core/document/answer-contracts.ts', '_extensions/course-core/document/assignment-contracts.ts', '_extensions/course-core/runtime/operation-*.ts', '_extensions/course-core/public.ts', '_extensions/course-navigation/record.ts', '_extensions/course-navigation/public.ts'];
export default [{
  files: scope.map(prefix => prefix + '**/*.ts'),
  ignores: ['**/vendor/**', '**/node_modules/**', '**/generated/**', '**/_generated/**'],
  languageOptions: { parser: tseslint.parser },
  plugins: { '@typescript-eslint': tseslint.plugin },
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false }],
    '@typescript-eslint/no-unsafe-type-assertion': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
  },
}, { files: structuralScope, rules: { complexity: ['error', 30], 'max-depth': ['error', 5], 'max-params': ['error', 5] } }];
