'use client';

import { useRef, useState, useEffect, useCallback, forwardRef } from 'react';

const SCROLLBAR_VISIBLE_MS = 1500;

type Props = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
};

const ScrollbarOnScrollArea = forwardRef<HTMLDivElement, Props>(function ScrollbarOnScrollArea(
  { children, className = '', ...props },
  ref
) {
  const internalRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    },
    [ref]
  );

  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;
    const handleScroll = () => {
      setIsScrolling(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
        timeoutRef.current = null;
      }, SCROLLBAR_VISIBLE_MS);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={setRef}
      className={`main-scroll-area ${isScrolling ? 'is-scrolling' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
});

export default ScrollbarOnScrollArea;
