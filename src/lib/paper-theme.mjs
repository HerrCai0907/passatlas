/**
 * Shiki 语法高亮主题：与 tokens.css 的纸面/墨色同一套色板。
 *
 * 旧配置用 github-light 的 token 颜色，却把 <pre> 背景强制压成深色，
 * 于是注释和普通标识符（#24292E）几乎消失在深底上。这里保留浅色底，
 * 并把高亮色换成分类色同源的暖色：指令用 accent，类型用青，变量用蓝，
 * 数字用紫，标签/函数用绛红。
 *
 * 改这里时请同步 tokens.css 里的 --accent / --cat-* 色值。
 */

const ink = '#2c313b';
const accent = '#b5450b';
const teal = '#0d6e66';
const blue = '#0a5f8f';
const violet = '#6330c4';
const crimson = '#ad1036';
const comment = '#6f6759';
const muted = '#5c6472';

/** @type {import('shiki').ThemeRegistration} */
export const paperTheme = {
  name: 'passatlas-paper',
  type: 'light',
  colors: {
    'editor.background': '#fffdf8',
    'editor.foreground': ink,
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: comment, fontStyle: 'italic' },
    },
    {
      scope: ['string', 'string.quoted', 'punctuation.definition.string'],
      settings: { foreground: teal },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character'],
      settings: { foreground: violet },
    },
    {
      scope: [
        'keyword',
        'keyword.instruction',
        'keyword.control',
        'storage.modifier',
        'storage.type.function.llvm',
      ],
      settings: { foreground: accent },
    },
    {
      scope: ['storage.type', 'entity.name.type', 'support.type', 'support.class'],
      settings: { foreground: teal },
    },
    {
      scope: ['variable', 'variable.other', 'variable.parameter'],
      settings: { foreground: blue },
    },
    {
      scope: ['entity.name.label', 'entity.name.function', 'support.function'],
      settings: { foreground: crimson },
    },
    {
      scope: ['punctuation', 'meta.punctuation'],
      settings: { foreground: muted },
    },
    {
      // shell 的参数串不必整段染色，留给正文墨色
      scope: ['string.unquoted.argument'],
      settings: { foreground: ink },
    },
  ],
};
