'use client';

import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { PeriodFilterOption } from '@/hooks/useStatementFilters';

export type FilterPeriod = string;

interface PeriodFilterProps {
  selectedPeriod: FilterPeriod;
  onPeriodChange: (period: FilterPeriod) => void;
  options: PeriodFilterOption[];
}

const STATEMENT_STYLES = [
  { bgColor: 'bg-blue-100', textColor: 'text-blue-700', hoverColor: 'hover:bg-blue-200' },
  { bgColor: 'bg-green-100', textColor: 'text-green-700', hoverColor: 'hover:bg-green-200' },
  { bgColor: 'bg-purple-100', textColor: 'text-purple-700', hoverColor: 'hover:bg-purple-200' },
  { bgColor: 'bg-pink-100', textColor: 'text-pink-700', hoverColor: 'hover:bg-pink-200' },
  { bgColor: 'bg-indigo-100', textColor: 'text-indigo-700', hoverColor: 'hover:bg-indigo-200' },
  { bgColor: 'bg-orange-100', textColor: 'text-orange-700', hoverColor: 'hover:bg-orange-200' },
  { bgColor: 'bg-teal-100', textColor: 'text-teal-700', hoverColor: 'hover:bg-teal-200' },
  { bgColor: 'bg-amber-100', textColor: 'text-amber-700', hoverColor: 'hover:bg-amber-200' }
];

const ACCUMULATIVE_STYLE = {
  bgColor: 'bg-gray-900',
  textColor: 'text-white',
  hoverColor: 'hover:bg-gray-800'
};

export default function PeriodFilter({ selectedPeriod, onPeriodChange, options }: PeriodFilterProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-lg shadow-lg p-4 mb-6"
    >
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar className="h-5 w-5" />
          <span className="font-medium">Period Filter:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {options.map((option, index) => {
            const style = option.type === 'accumulative'
              ? ACCUMULATIVE_STYLE
              : STATEMENT_STYLES[index % STATEMENT_STYLES.length];

            const isSelected = selectedPeriod === option.key;

            return (
              <button
                key={option.key}
                onClick={() => onPeriodChange(option.key)}
                className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                  isSelected
                    ? `${style.bgColor} ${style.textColor} ring-2 ring-offset-1 ring-blue-500`
                    : `${style.bgColor} ${style.textColor} ${style.hoverColor}`
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
