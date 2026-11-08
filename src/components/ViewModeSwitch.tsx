import { defaultLocale, type Locale } from '../i18n/config';
import { t } from '../i18n/ui';
import './ViewModeSwitch.css';

export type ViewMode = 'cfg' | 'ir';

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  locale?: Locale;
  label?: string;
}

/** IR 展示模块统一的「图 / 文」切换。默认选 CFG。 */
export default function ViewModeSwitch({
  value,
  onChange,
  locale = defaultLocale,
  label,
}: Props) {
  return (
    <div className="vm" role="group" aria-label={label ?? t(locale, 'viewMode.group')}>
      <button
        type="button"
        aria-pressed={value === 'cfg'}
        onClick={() => onChange('cfg')}
        title={t(locale, 'viewMode.cfgTitle')}
      >
        CFG
      </button>
      <button
        type="button"
        aria-pressed={value === 'ir'}
        onClick={() => onChange('ir')}
        title={t(locale, 'viewMode.irTitle')}
      >
        IR
      </button>
    </div>
  );
}
