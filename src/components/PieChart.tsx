"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { ChartDataPoint } from "@/types/transaction";
import { getCategoryHexColor } from "@/constants/categories";

interface PieChartComponentProps {
  data: ChartDataPoint[];
  onSegmentClick?: (category: string) => void;
  selectedCategory?: string | null;
  colorMap?: Record<string, string>;
}

const CenterLabel = ({ total, title }: { total: number; title?: string }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="text-center">
      {title && (
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase mb-1">
          {title}
        </div>
      )}
      <div className="text-xl font-bold text-gray-900 dark:text-white">
        {total.toLocaleString("en-NZ", {
          style: "currency",
          currency: "NZD",
        })}
      </div>
    </div>
  </div>
);

export default function PieChartComponent({
  data,
  onSegmentClick,
  selectedCategory,
  colorMap,
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
        <p className="text-sm text-gray-500">
          No data available for the selected filters.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative w-full h-full outline-none focus:outline-none"
      style={{ outline: "none" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart style={{ outline: "none" }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={115}
            startAngle={90}
            endAngle={450}
            dataKey="value"
            paddingAngle={4}
            cornerRadius={8}
          >
            {data.map((entry, index) => {
              const entryColor =
                typeof entry.color === "string" ? entry.color : undefined;
              const colorFromMap = colorMap ? colorMap[entry.name] : undefined;
              // Prioritize entry.color (for subcategories with variants), then colorMap, then default category colors
              const fillColor =
                entryColor || colorFromMap || getCategoryHexColor(entry.name);

              return (
                <Cell
                  key={`cell-${index}`}
                  fill={fillColor}
                  stroke="#ffffff"
                  strokeWidth={6}
                  className={`${
                    isInteractive ? "cursor-pointer" : "cursor-default"
                  } hover:opacity-80 transition-opacity duration-200`}
                  onClick={
                    onSegmentClick
                      ? () => onSegmentClick(entry.name)
                      : undefined
                  }
                />
              );
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <CenterLabel total={totalAmount} />
    </motion.div>
  );
}
