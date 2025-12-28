'use client';

import { PeriodFilterOption } from '@/hooks/useStatementFilters';

export type FilterPeriod = string;

interface PeriodFilterProps {
  selectedPeriod: FilterPeriod;
  onPeriodChange: (period: FilterPeriod) => void;
  options: PeriodFilterOption[];
}

export default function PeriodFilter({ selectedPeriod, onPeriodChange, options }: PeriodFilterProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      {options.map((option, index) => {
        const isSelected = selectedPeriod === option.key;
        const isFirst = index === 0;

        return (
          <button
            key={option.key}
            onClick={() => onPeriodChange(option.key)}
            className={`flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                : 'bg-background-light dark:bg-background-dark text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            <span>{option.label}</span>
            {isFirst && isSelected && (
              <svg fill="currentColor" height="16" viewBox="0 0 256 256" width="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
