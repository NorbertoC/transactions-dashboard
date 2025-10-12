'use client';

import { ChevronDown } from 'lucide-react';
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
                : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            <span>{option.label}</span>
            {isFirst && isSelected && <ChevronDown size={16} />}
          </button>
        );
      })}
    </div>
  );
}
