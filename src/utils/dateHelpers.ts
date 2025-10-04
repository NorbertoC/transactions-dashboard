import { FilterPeriod } from '@/components/PeriodFilter';

export function getPeriodDates(period: FilterPeriod): { startDate: string; endDate: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (period) {
    case 'lastMonth': {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return {
        startDate: oneMonthAgo.toISOString().split('T')[0],
        endDate: today
      };
    }

    case 'lastStatement': {
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
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    }

    case 'last3Months': {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return {
        startDate: threeMonthsAgo.toISOString().split('T')[0],
        endDate: today
      };
    }

    case 'last6Months': {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return {
        startDate: sixMonthsAgo.toISOString().split('T')[0],
        endDate: today
      };
    }

    case 'lastYear': {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return {
        startDate: oneYearAgo.toISOString().split('T')[0],
        endDate: today
      };
    }

    default:
      return {
        startDate: '',
        endDate: today
      };
  }
}