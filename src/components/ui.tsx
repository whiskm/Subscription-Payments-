import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export function Section({ title, aside, onAside, children }: { title: string; aside?: ReactNode; onAside?: () => void; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        {aside &&
          (onAside ? (
            <button className="section__aside" onClick={onAside}>
              {aside}
            </button>
          ) : (
            <span className="section__aside">{aside}</span>
          ))}
      </div>
      {children}
    </section>
  );
}

export function IconButton({ icon, label, onClick, bare }: { icon: IconName; label: string; onClick: () => void; bare?: boolean }) {
  return (
    <button type="button" className={bare ? 'icon-btn icon-btn--bare' : 'icon-btn'} onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export interface Option<T> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={String(o.value)} role="radio" aria-checked={o.value === value} className="seg__item" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string | number>({
  value,
  options,
  onChange,
  label,
  scroll,
}: {
  value: T;
  options: Array<Option<T> & { color?: string }>;
  onChange: (v: T) => void;
  label: string;
  scroll?: boolean;
}) {
  return (
    <div className={scroll ? 'chips chips--scroll' : 'chips'} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className="chip"
          style={o.color ? ({ '--brand': o.color } as CSSProperties) : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.color && <i className="chip__dot" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Several values can be on at once (reminder days, for example). */
export function MultiChips<T extends string | number>({ values, options, onToggle, label }: { values: T[]; options: Option<T>[]; onToggle: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={String(o.value)} className="chip" aria-pressed={values.includes(o.value)} onClick={() => onToggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Swatches({ value, colors, onChange, label }: { value: string; colors: string[]; onChange: (c: string) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button
          type="button"
          key={c}
          role="radio"
          aria-checked={c.toLowerCase() === value.toLowerCase()}
          aria-label={c}
          className="swatch"
          style={{ '--c': c } as CSSProperties}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="−" disabled={value <= min}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <output>{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="+" disabled={value >= max}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  autoFocus,
  autoComplete = 'off',
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="input-row">
      <input
        className="input input--mono"
        type={shown ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <IconButton bare icon={shown ? 'eyeOff' : 'eye'} label={shown ? 'Hide' : 'Show'} onClick={() => setShown((s) => !s)} />
    </div>
  );
}

/** One line of a settings list. */
export function Row({
  icon,
  label,
  hint,
  value,
  onClick,
  children,
  danger,
}: {
  icon?: IconName;
  label: ReactNode;
  hint?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
  danger?: boolean;
}) {
  const content = (
    <>
      {icon && <Icon name={icon} className="row__icon" />}
      <div className="row__text">
        <div className="row__label">{label}</div>
        {hint && <div className="row__hint">{hint}</div>}
      </div>
      {value !== undefined && <div className="row__value">{value}</div>}
      {children}
      {onClick && !children && <Icon name="chevR" size={18} className="row__icon" />}
    </>
  );
  const cls = danger ? 'row row--danger' : 'row';
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function Leader({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? 'leader leader--strong' : 'leader'}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
