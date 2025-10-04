'use client';

import { motion } from 'framer-motion';
import { Calendar, X } from 'lucide-react';

interface DateFilterProps {
  startDate: string | null;
  endDate: string | null;
  onStartDateChange: (date: string | null) => void;
  onEndDateChange: (date: string | null) => void;
  onReset: () => void;
}

export default function DateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onReset
}: DateFilterProps) {
  const today = new Date().toISOString().split('T')[0];
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const defaultStartDate = oneMonthAgo.toISOString().split('T')[0];

  // Calculate last statement period (20th to 20th)
  const getLastStatementPeriod = () => {
    const now = new Date();
    const currentDay = now.getDate();

    let endDate: Date;
    let startDate: Date;

    if (currentDay >= 20) {
      // If we're past the 20th, the statement period is from last month's 20th to this month's 20th
      endDate = new Date(now.getFullYear(), now.getMonth(), 20);
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 20);
    } else {
      // If we're before the 20th, the statement period is from two months ago's 20th to last month's 20th
      endDate = new Date(now.getFullYear(), now.getMonth() - 1, 20);
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 20);
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  const hasFilter = startDate || endDate;

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
          <span className="font-medium">Date Filter:</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => onStartDateChange(e.target.value || null)}
              max={today}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => onEndDateChange(e.target.value || null)}
              min={startDate || undefined}
              max={today}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              onStartDateChange(defaultStartDate);
              onEndDateChange(today);
            }}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
          >
            Last Month
          </button>

          <button
            onClick={() => {
              const statementPeriod = getLastStatementPeriod();
              onStartDateChange(statementPeriod.start);
              onEndDateChange(statementPeriod.end);
            }}
            className="px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
          >
            Last Statement
          </button>

          {hasFilter && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={onReset}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
            >
              <X className="h-4 w-4" />
              Clear
            </motion.button>
          )}
        </div>
      </div>

      {hasFilter && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-gray-200"
        >
          <p className="text-sm text-gray-600">
            Filtering transactions from{' '}
            {startDate ? (
              <span className="font-medium">
                {new Date(startDate).toLocaleDateString('en-NZ')}
              </span>
            ) : (
              'the beginning'
            )}{' '}
            to{' '}
            {endDate ? (
              <span className="font-medium">
                {new Date(endDate).toLocaleDateString('en-NZ')}
              </span>
            ) : (
              'the end'
            )}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}