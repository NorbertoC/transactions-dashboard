'use client';

import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';

export type FilterPeriod = 'lastMonth' | 'lastStatement' | 'last3Months' | 'last6Months' | 'lastYear';

interface PeriodFilterProps {
  selectedPeriod: FilterPeriod;
  onPeriodChange: (period: FilterPeriod) => void;
}

const filterOptions = [
  { key: 'lastMonth' as FilterPeriod, label: 'Last Month', bgColor: 'bg-blue-100', textColor: 'text-blue-700', hoverColor: 'hover:bg-blue-200' },
  { key: 'lastStatement' as FilterPeriod, label: 'Last Statement', bgColor: 'bg-green-100', textColor: 'text-green-700', hoverColor: 'hover:bg-green-200' },
  { key: 'last3Months' as FilterPeriod, label: 'Last 3 Months', bgColor: 'bg-purple-100', textColor: 'text-purple-700', hoverColor: 'hover:bg-purple-200' },
  { key: 'last6Months' as FilterPeriod, label: 'Last 6 Months', bgColor: 'bg-orange-100', textColor: 'text-orange-700', hoverColor: 'hover:bg-orange-200' },
  { key: 'lastYear' as FilterPeriod, label: 'Last Year', bgColor: 'bg-red-100', textColor: 'text-red-700', hoverColor: 'hover:bg-red-200' },
];

export default function PeriodFilter({ selectedPeriod, onPeriodChange }: PeriodFilterProps) {
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
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => onPeriodChange(option.key)}
              className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                selectedPeriod === option.key
                  ? `${option.bgColor} ${option.textColor} ring-2 ring-offset-1 ring-blue-500`
                  : `${option.bgColor} ${option.textColor} ${option.hoverColor}`
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}