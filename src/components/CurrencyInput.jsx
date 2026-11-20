import React from 'react';
import { formatCurrencyInput, parseCurrencyInput } from '../utils/formatters';

export default function CurrencyInput({
  id,
  value,
  onChange,
  placeholder = '0,00',
  required = false,
  autoFocus = false,
  className = '',
  style,
  disabled = false,
  ariaLabel
}) {
  const displayValue = formatCurrencyInput(value);

  const handleChange = (e) => {
    const parsed = parseCurrencyInput(e.target.value);
    if (onChange) {
      onChange({
        target: {
          id,
          value: parsed
        }
      });
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      autoFocus={autoFocus}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      style={style}
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
    />
  );
}
