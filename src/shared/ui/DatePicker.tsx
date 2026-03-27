import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';
import './DatePicker.css';

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

// Monday = 0 … Sunday = 6
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday=0
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDate(str: string): { year: number; month: number; day: number } | null {
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { year: y, month: m - 1, day: d };
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function DatePicker({ label, value, onChange, error }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseDate(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keep calendar within viewport by running inline after each open
  useEffect(() => {
    if (!open) return;
    const cal = calendarRef.current;
    if (!cal) return;
    requestAnimationFrame(() => {
      cal.style.left = '0';
      cal.style.right = 'auto';
      cal.style.top = '100%';
      cal.style.bottom = 'auto';
      const calRect = cal.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (calRect.right > vw - 8) { cal.style.left = 'auto'; cal.style.right = '0'; }
      if (calRect.bottom > vh - 8) { cal.style.top = 'auto'; cal.style.bottom = '100%'; }
    });
  }, [open]);

  // When opening, sync calendar view to current value
  const handleOpen = () => {
    const p = parseDate(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
    setOpen(true);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const prevYear = () => setViewYear(viewYear - 1);
  const nextYear = () => setViewYear(viewYear + 1);

  const selectDay = (day: number) => {
    onChange(formatDate(viewYear, viewMonth, day));
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const selectToday = () => {
    const t = new Date();
    onChange(formatDate(t.getFullYear(), t.getMonth(), t.getDate()));
    setOpen(false);
  };

  const clearDate = () => {
    onChange('');
    setOpen(false);
  };

  const inputId = `dp-${label.toLowerCase().replace(/\s+/g, '-')}`;

  // Build day cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <div className={`field datepicker ${error ? 'field--error' : ''}`} ref={containerRef}>
      <label className="field__label" htmlFor={inputId}>{label}</label>
      <div className="datepicker__input-wrap">
        <input
          id={inputId}
          className="field__input"
          type="text"
          placeholder="YYYY-MM-DD"
          value={value}
          onChange={handleInputChange}
          onFocus={handleOpen}
          autoComplete="off"
        />
        <button
          type="button"
          className="datepicker__toggle"
          onClick={() => open ? setOpen(false) : handleOpen()}
          aria-label="Toggle calendar"
          tabIndex={-1}
        >
          <Icon name="calendar" size={14} />
        </button>
      </div>

      {open && (
        <div className="datepicker__calendar" ref={calendarRef}>
          {/* Year navigation */}
          <div className="datepicker__year-nav">
            <button type="button" onClick={prevYear} className="datepicker__nav-btn" aria-label="Previous year">‹‹</button>
            <span className="datepicker__year-label">{viewYear}</span>
            <button type="button" onClick={nextYear} className="datepicker__nav-btn" aria-label="Next year">››</button>
          </div>

          {/* Month navigation */}
          <div className="datepicker__nav">
            <button type="button" onClick={prevMonth} className="datepicker__nav-btn">‹</button>
            <span className="datepicker__nav-label">
              {MONTH_NAMES[viewMonth]}
            </span>
            <button type="button" onClick={nextMonth} className="datepicker__nav-btn">›</button>
          </div>

          <div className="datepicker__weekdays">
            {DAYS.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="datepicker__days">
            {cells.map((day, i) =>
              day === null ? (
                <span key={`empty-${i}`} className="datepicker__day datepicker__day--empty" />
              ) : (
                <button
                  key={day}
                  type="button"
                  className={[
                    'datepicker__day',
                    parsed && day === parsed.day && viewMonth === parsed.month && viewYear === parsed.year
                      ? 'datepicker__day--selected' : '',
                    isToday(day) && !(parsed && day === parsed.day && viewMonth === parsed.month && viewYear === parsed.year)
                      ? 'datepicker__day--today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              )
            )}
          </div>

          <div className="datepicker__footer">
            <button type="button" className="datepicker__footer-btn" onClick={selectToday}>Today</button>
            {value && <button type="button" className="datepicker__footer-btn datepicker__footer-btn--clear" onClick={clearDate}>Clear</button>}
          </div>
        </div>
      )}

      {error && (
        <span className="field__error" role="alert">{error}</span>
      )}
    </div>
  );
}
