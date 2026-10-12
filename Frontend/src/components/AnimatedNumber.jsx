import { useState, useEffect, useRef } from 'react';

/**
 * AnimatedNumber
 * Smoothly counts up/down when numeric value changes to eliminate static template feel.
 */
export function AnimatedNumber({
  value = 0,
  duration = 600,
  prefix = '',
  suffix = '',
  decimals = 0,
  formatComma = true,
  style = {},
  className = '',
}) {
  const numericTarget = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0;
  const [displayValue, setDisplayValue] = useState(numericTarget);
  const prevValueRef = useRef(numericTarget);
  const animRef = useRef(null);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = numericTarget;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [numericTarget, duration]);

  const formatted = decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue).toString();
  const parts = formatted.split('.');
  if (formatComma) {
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  const result = parts.join('.');

  return (
    <span className={className} style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}
      {result}
      {suffix}
    </span>
  );
}
