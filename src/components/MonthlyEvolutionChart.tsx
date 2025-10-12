'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Transaction } from '@/types/transaction';

interface MonthlyEvolutionChartProps {
  transactions: Transaction[];
  selectedCategory?: string | null;
  categoryColors?: Record<string, string>;
}

interface MonthlyData {
  month: string;
  monthKey: string;
  amount: number;
  count: number;
}

const COLORS = [
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16'  // Lime
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      amount: number;
      count: number;
    };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900">{`${label}`}</p>
        <p className="text-sm text-gray-600">
          {`Amount: ${data.amount.toLocaleString('en-NZ', {
            style: 'currency',
            currency: 'NZD'
          })}`}
        </p>
        <p className="text-sm text-gray-600">
          {`Transactions: ${data.count}`}
        </p>
      </div>
    );
  }
  return null;
}

export default function MonthlyEvolutionChart({
  transactions,
  selectedCategory,
  categoryColors
}: MonthlyEvolutionChartProps) {
  // Filter transactions by category if selected
  const filteredTransactions = selectedCategory
    ? transactions.filter(t => t.category === selectedCategory)
    : transactions;

  // Group transactions by month
  const monthlyData = filteredTransactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date_iso);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = MONTH_NAMES[date.getMonth()];

    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: monthName,
        monthKey,
        amount: 0,
        count: 0
      };
    }

    acc[monthKey].amount += transaction.value;
    acc[monthKey].count += 1;

    return acc;
  }, {} as Record<string, MonthlyData>);

  // Convert to array and sort by month
  const chartData = Object.values(monthlyData)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-6); // Show last 6 months

  const categoryColor = selectedCategory
    ? (categoryColors?.[selectedCategory] || COLORS[Math.abs(selectedCategory.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % COLORS.length])
    : '#8B5CF6';

  if (chartData.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Monthly Evolution</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">$0</p>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Last 6 Months</span>
        </div>
        <div className="mt-6 h-60 w-full flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">No data available to display</p>
        </div>
      </div>
    );
  }

  const totalAmount = chartData.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Monthly Evolution</h3>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">${totalAmount.toFixed(0)}</p>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="text-gray-500 dark:text-gray-400">Last 6 Months</span>
        <span className="font-medium text-red-500">-5%</span>
      </div>
      <div className="mt-6 h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="amount"
              fill={categoryColor}
              radius={[4, 4, 0, 0]}
              className="hover:opacity-80 transition-opacity duration-200"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
