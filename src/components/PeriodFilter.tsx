'use client';

import { Fragment } from 'react';
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
  const getOptionLabel = (option: PeriodFilterOption) => {
    if (option.key === 'accumulative:3') return t('period.last3');
    if (option.key === 'accumulative:6') return t('period.last6');
    if (option.key === 'accumulative:12') return t('period.last12');
    if (option.key === 'accumulative:all') return t('period.allTime');
    return option.label;
  };
  return (
    <div
      role="group"
      aria-label={t('period.filterAria')}
      className="flex snap-x gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1"
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
  );
}
