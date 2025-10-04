'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { ChartDataPoint } from '@/types/transaction';

interface PieChartComponentProps {
  data: ChartDataPoint[];
  onSegmentClick?: (category: string) => void;
  selectedCategory?: string | null;
}

const COLORS = [
  '#8B5CF6', // Purple for largest segment
  '#EC4899', // Pink for second segment
  '#6B7280', // Gray for smallest segment
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple variant
  '#06B6D4', // Cyan
  '#84CC16'  // Lime
];

const CenterLabel = ({ total, title }: { total: number; title?: string }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="text-center">
      {title && (
        <div className="text-xs font-semibold text-gray-500 tracking-wide uppercase mb-1">
          {title}
        </div>
      )}
      <div className="text-2xl font-bold text-gray-900">
        {total.toLocaleString('en-NZ', {
          style: 'currency',
          currency: 'NZD'
        })}
      </div>
    </div>
  </div>
);

export default function PieChartComponent({
  data,
  onSegmentClick,
  selectedCategory
}: PieChartComponentProps) {
  const totalAmount = data.reduce((sum, item) => sum + item.value, 0);
  const isInteractive = Boolean(onSegmentClick);

  if (!data || data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative w-full h-full flex items-center justify-center"
      >
        <p className="text-sm text-gray-500">No data available for the selected filters.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative w-full h-full outline-none focus:outline-none"
      style={{ outline: 'none' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart style={{ outline: 'none' }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={100}
            outerRadius={170}
            startAngle={90}
            endAngle={450}
            dataKey="value"
            paddingAngle={4}
            cornerRadius={8}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                stroke="#ffffff"
                strokeWidth={6}
                className={`${isInteractive ? 'cursor-pointer' : 'cursor-default'} hover:opacity-80 transition-opacity duration-200`}
                onClick={onSegmentClick ? () => onSegmentClick(entry.name) : undefined}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <CenterLabel total={totalAmount} title={selectedCategory || undefined} />
    </motion.div>
  );
}
