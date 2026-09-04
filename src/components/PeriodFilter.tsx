'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PeriodFilterOption } from '@/hooks/useStatementFilters';
import { useLocale } from '@/i18n/LocaleProvider';

export type FilterPeriod = string;

interface PeriodFilterProps {
  selectedPeriod: FilterPeriod;
  onPeriodChange: (period: FilterPeriod) => void;
  options: PeriodFilterOption[];
}

export default function PeriodFilter({ selectedPeriod, onPeriodChange, options }: PeriodFilterProps) {
  const { t } = useLocale();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const remaining = scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft;
    setCanScrollLeft(scroller.scrollLeft > 4);
    setCanScrollRight(remaining > 4);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    updateScrollState();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(scroller);
    window.addEventListener('resize', updateScrollState);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [options, updateScrollState]);

  const scrollByPage = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({
      left: direction * Math.max(240, scrollerRef.current.clientWidth * 0.7),
      behavior: 'smooth'
    });
  };

  const getOptionLabel = (option: PeriodFilterOption) => {
    if (option.key === 'accumulative:3') return t('period.last3');
    if (option.key === 'accumulative:6') return t('period.last6');
    if (option.key === 'accumulative:12') return t('period.last12');
    if (option.key === 'accumulative:all') return t('period.allTime');
    return option.label;
  };

  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        aria-label={t('period.scrollPrevious')}
        disabled={!canScrollLeft}
        className="hidden min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-muted shadow-sm transition-colors hover:text-foreground disabled:invisible sm:inline-flex"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <div
        ref={scrollerRef}
        onScroll={updateScrollState}
        role="group"
        aria-label={t('period.filterAria')}
        className="-mx-4 flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0"
      >
        {options.map((option, index) => {
          const isSelected = selectedPeriod === option.key;
          const previous = options[index - 1];
          const showDivider = previous !== undefined && previous.type !== option.type;

          return (
            <Fragment key={option.key}>
              {showDivider && <span aria-hidden="true" className="w-px self-stretch bg-border-subtle" />}
              <button
                type="button"
                onClick={() => onPeriodChange(option.key)}
                aria-pressed={isSelected}
                className={`min-h-11 snap-start whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-border-subtle bg-surface text-muted hover:text-foreground'
                }`}
              >
                {getOptionLabel(option)}
              </button>
            </Fragment>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        aria-label={t('period.scrollNext')}
        disabled={!canScrollRight}
        className="hidden min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-muted shadow-sm transition-colors hover:text-foreground disabled:invisible sm:inline-flex"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
      {canScrollLeft && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-4 inset-y-0 w-8 bg-gradient-to-r from-background to-transparent sm:hidden"
        />
      )}
      {canScrollRight && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 inset-y-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden"
        />
      )}
      {canScrollLeft && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-[3.25rem] hidden w-8 bg-gradient-to-r from-background to-transparent sm:block"
        />
      )}
      {canScrollRight && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-[3.25rem] hidden w-10 bg-gradient-to-l from-background to-transparent sm:block"
        />
      )}
    </div>
  );
}
