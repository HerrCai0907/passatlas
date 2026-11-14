import { useMemo } from 'react';
import { formatClass, type IRFormat } from '../lib/ir/format';
import { tokenizeIR } from '../lib/ir/highlight';

/** 一行 IR 的语法高亮；容器类名决定用 LLVM IR 还是 MIR 的调色板 */
export default function IRText({ text, format }: { text: string; format: IRFormat }) {
  const tokens = useMemo(() => tokenizeIR(text, format), [text, format]);

  return (
    <span className={`ir-text ${formatClass(format)}`}>
      {tokens.map((token, index) =>
        token.kind === 'plain' ? (
          token.text
        ) : (
          <span key={index} className={`ir-tok ir-tok--${token.kind}`}>
            {token.text}
          </span>
        ),
      )}
    </span>
  );
}
