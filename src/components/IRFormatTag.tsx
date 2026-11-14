import { defaultLocale, type Locale } from '../i18n/config';
import { t } from '../i18n/ui';
import type { IRFormat } from '../lib/ir/format';
import './IRFormatTag.css';

/** IR block 的格式标签：这一块到底是 LLVM IR 还是 Machine IR */
export default function IRFormatTag({
  format,
  locale = defaultLocale,
}: {
  format: IRFormat;
  locale?: Locale;
}) {
  const mirror = format === 'mir';
  return (
    <span className={`ir-tag ir-tag--${mirror ? 'mir' : 'llvm'}`}>
      {t(locale, mirror ? 'format.machineIr' : 'format.llvmIr')}
    </span>
  );
}
