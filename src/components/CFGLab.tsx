import { useEffect, useMemo, useState } from 'react';
import CFGViewer from './CFGViewer';
import IRFormatTag from './IRFormatTag';
import type { LocalizedCFGSample } from '../data/cfg-samples';
import { defaultLocale, type Locale } from '../i18n/config';
import { t } from '../i18n/ui';
import type { IRFormat } from '../lib/ir/format';
import { parseSource } from '../lib/ir/source';
import './CFGLab.css';

interface Props {
  samples: LocalizedCFGSample[];
  locale?: Locale;
}

const FORMATS: IRFormat[] = ['llvm-ir', 'mir'];

export default function CFGLab({ samples, locale = defaultLocale }: Props) {
  const first = samples[0];
  const [format, setFormat] = useState<IRFormat>(first?.format ?? 'llvm-ir');
  const [text, setText] = useState(first?.ir ?? '');
  const [debounced, setDebounced] = useState(text);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(text), 220);
    return () => window.clearTimeout(timer);
  }, [text]);

  // 支持 /ir/?sample=loop、/ir/?sample=mir-loop 这样的直达链接
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('sample');
    if (!id) return;
    const sample = samples.find((item) => item.id === id);
    if (!sample) return;
    setFormat(sample.format);
    setText(sample.ir);
    setDebounced(sample.ir);
  }, [samples]);

  const parsed = useMemo(() => parseSource(debounced, format, locale), [debounced, format, locale]);

  const stats = useMemo(() => {
    const blocks = parsed.functions.reduce((sum, fn) => sum + fn.blocks.length, 0);
    const edges = parsed.functions.reduce((sum, fn) => sum + fn.edges.length, 0);
    return { functions: parsed.functions.length, blocks, edges };
  }, [parsed]);

  const visibleSamples = useMemo(
    () => samples.filter((sample) => sample.format === format),
    [samples, format],
  );

  // 用文本反推当前示例：用户一改 IR 就不再高亮任何示例，永远不会和 textarea 不一致
  const activeSample = visibleSamples.find((sample) => sample.ir === text);
  const lines = text.split('\n').length;

  const loadSample = (sample: LocalizedCFGSample) => {
    setText(sample.ir);
    setDebounced(sample.ir);
  };

  // 切换 IR 类型时，如果当前文本正好是一个示例，就换到新格式的第一个示例；
  // 自定义文本保留下来，直接交给新格式的解析器。
  const changeFormat = (next: IRFormat) => {
    if (next === format) return;
    const currentSample = samples.find((sample) => sample.ir === text);
    setFormat(next);
    if (!currentSample) return;
    const nextSample = samples.find((sample) => sample.format === next);
    if (nextSample) {
      setText(nextSample.ir);
      setDebounced(nextSample.ir);
    }
  };

  return (
    <div className="lab">
      <div className="lab__toolbar">
        <span className="lab__label">{t(locale, 'lab.format')}</span>
        <div className="lab__formats" role="group" aria-label={t(locale, 'lab.format')}>
          {FORMATS.map((item) => (
            <button
              key={item}
              type="button"
              className="lab__format"
              aria-pressed={format === item}
              onClick={() => changeFormat(item)}
            >
              {t(locale, item === 'mir' ? 'format.machineIr' : 'format.llvmIr')}
            </button>
          ))}
        </div>
        <span className="lab__label">{t(locale, 'lab.samples')}</span>
        <div className="lab__samples">
          {visibleSamples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="lab__sample"
              aria-pressed={activeSample?.id === sample.id}
              onClick={() => loadSample(sample)}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <span className="lab__stats">
          {t(locale, 'lab.stats', {
            functions: stats.functions,
            blocks: stats.blocks,
            edges: stats.edges,
          })}
        </span>
      </div>

      <div className="lab__grid">
        <section className="lab__editor" aria-labelledby="lab-editor-title">
          <header className="lab__editor-head">
            <div className="lab__editor-title">
              <h2 id="lab-editor-title">{t(locale, 'lab.editorTitle')}</h2>
              <IRFormatTag format={format} locale={locale} />
            </div>
            <span className="lab__lines">{t(locale, 'lab.lines', { count: lines })}</span>
          </header>
          <textarea
            className="lab__textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            aria-label={t(locale, format === 'mir' ? 'lab.mirLabel' : 'lab.irLabel')}
          />
          <p className="lab__note">
            {activeSample ? activeSample.description : t(locale, 'lab.custom')}
            <span>{t(locale, 'lab.local')}</span>
          </p>
        </section>

        <div className="lab__viewer">
          <CFGViewer
            ir={debounced}
            format={format}
            locale={locale}
            title={t(locale, 'lab.viewerTitle')}
            height={640}
          />
        </div>
      </div>
    </div>
  );
}
