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

// Custom center label component
const CenterLabel = ({ total }: { total: number }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900">
          {total.toLocaleString('en-NZ', {
            style: 'currency',
            currency: 'NZD'
          })}
        </div>
      </div>
    </div>
  );
};

// Custom label for segments showing category totals
const RADIAN = Math.PI / 180;
const renderCategoryLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  value,
  index
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  value: number;
  index: number;
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize="12"
      fontWeight="bold"
      className="drop-shadow-md"
    >
      {value.toLocaleString('en-NZ', {
        style: 'currency',
        currency: 'NZD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })}
    </text>
  );
};

// Custom cell component with padding between segments
const PaddedCell = ({ entry, index, onClick, isSelected }: {
  entry: ChartDataPoint;
  index: number;
  onClick: (data: ChartDataPoint) => void;
  isSelected: boolean;
}) => {
  return (
    <Cell
      key={`cell-${index}`}
      fill={COLORS[index % COLORS.length]}
      stroke="#ffffff"
      strokeWidth={8} // Creates spacing between segments
      className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
      onClick={() => onClick(entry)}
    />
  );
};

export default function PieChartComponent({
  data,
  onSegmentClick,
  selectedCategory
}: PieChartComponentProps) {
  const handleClick = (data: ChartDataPoint) => {
    if (onSegmentClick) {
      onSegmentClick(data.name);
    }
  };

  const totalAmount = data.reduce((sum, item) => sum + item.value, 0);

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
            paddingAngle={4} // Creates gaps between segments
            cornerRadius={8} // Rounded corners for segments
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                onClick={() => handleClick(entry)}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <CenterLabel total={totalAmount} />
    </motion.div>
  );
}