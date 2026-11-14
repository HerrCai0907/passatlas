/**
 * MIR 文本里与操作码有关的小工具。
 *
 * 这里只做词法层面的判断：知道哪类操作码是终结指令、哪类带条件跳转，
 * 具体一条指令跳到哪个块由 parser 用 `%bb.N` 引用解析。
 */

/** 从一行 MIR 里取操作码：`%0:gr32 = COPY $edi` → COPY，`RET64 $eax` → RET64 */
export function mirOpcode(text: string): string {
  const withResult = /=\s*([A-Za-z_][\w.]*)/.exec(text);
  if (withResult?.[1]) return withResult[1];
  return /^([A-Za-z_][\w.]*)/.exec(text.trim())?.[1] ?? '';
}

/** MIR 里会结束基本块、或带显式跳转目标的操作码 */
export function isMIRTerminator(opcode: string): boolean {
  if (opcode === 'B' || opcode === 'BR' || opcode === 'Bcc') return true;
  if (/^B\.[A-Z]+$/.test(opcode)) return true;
  return /^(JMP_|JCC_|BRANCH_|CBZ|CBNZ|TBZ|TBNZ|RET|TCRETURN|TAILJMP|INLINEASM_BR|PATCHABLE_RET|CATCHRET|CLEANUPRET)/.test(
    opcode,
  );
}

/** 条件跳转：目标边标 taken，顺序落下的一条标 fallthrough */
export function isMIRConditionalBranch(opcode: string): boolean {
  if (opcode === 'Bcc' || /^B\.[A-Z]+$/.test(opcode)) return true;
  return /^(JCC_|CBZ|CBNZ|TBZ|TBNZ)/.test(opcode);
}

/** 指令里引用的机器基本块，`%bb.1.then(32)` → `bb.1.then` */
export function mirBlockRefs(text: string): string[] {
  return [...text.matchAll(/%bb\.[\w.]+/g)].map((match) => match[0].slice(1));
}
