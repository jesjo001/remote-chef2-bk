import { IPricingConfig } from '../models/PricingConfig';

export interface AddOnSelection {
  name: string;
  price: number;
  quantity: number;
}

export interface PricingBreakdown {
  mealsPerDay: number;
  scheduleType: 'workdays' | 'alldays';
  deliveryDays: number;

  // Per day
  mealCostPerDay: number;
  deliveryFee: number;
  addOnsPerDay: number;  // Total add-ons cost per day
  dailyTotal: number;

  // Monthly
  monthlyBase: number;
  processingFee: number;
  totalAmount: number;

  // Cost / profit (for admin snapshot)
  mealCostPrice: number;
  deliveryCostPrice: number;
  addOnsCostPerDay: number;
  totalCost: number;
  totalProfit: number;
  profitMarginPercent: number;
}

export interface MonthlyPricingBreakdown extends PricingBreakdown {
  month: number;  // 0-11
  year: number;
  monthName: string;
  startDate: Date;
  endDate: Date;
}

export interface YearlyBreakdown {
  months: MonthlyPricingBreakdown[];
  totalAmount12Months: number;
  averageMonthlyAmount: number;
  minMonthAmount: number;
  maxMonthAmount: number;
}

export function calculatePricing(
  config: IPricingConfig,
  mealsPerDay: 1 | 2,
  scheduleType: 'workdays' | 'alldays',
  portions: number = 1,
  addOns: AddOnSelection[] = []
): PricingBreakdown {
  const deliveryDays = scheduleType === 'workdays' ? config.workdayCount : config.allDayCount;

  // Find portion pricing (default to base meal price if not found)
  let portionPrice = config.mealPrice;
  let portionCost = config.mealCostPrice;
  
  const selectedPortion = config.portionOptions?.find(p => p.portions === portions);
  if (selectedPortion) {
    portionPrice = selectedPortion.price;
    portionCost = selectedPortion.cost;
  }

  // Selling price calculations
  const addOnsPerDay = addOns.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const mealCostPerDay = portionPrice * mealsPerDay;
  const dailyTotal = mealCostPerDay + config.deliveryFee + addOnsPerDay;
  const monthlyBase = dailyTotal * deliveryDays;
  const totalAmount = monthlyBase + config.processingFee;

  // Cost price calculations (for margin tracking)
  const addOnsCostPerDay = addOns.reduce((sum, item) => {
    const addOnConfig = config.addOns?.find(a => a.name === item.name);
    return sum + ((addOnConfig?.cost || item.price) * item.quantity);
  }, 0);
  const mealCostPerDayActual = portionCost * mealsPerDay;
  const dailyCost = mealCostPerDayActual + config.deliveryCostPrice + addOnsCostPerDay;
  const totalCost = dailyCost * deliveryDays; // Processing fee is pure profit, not a cost
  const totalProfit = totalAmount - totalCost;
  const profitMarginPercent = Math.round((totalProfit / totalAmount) * 100);

  return {
    mealsPerDay,
    scheduleType,
    deliveryDays,
    mealCostPerDay,
    deliveryFee: config.deliveryFee,
    addOnsPerDay,
    dailyTotal,
    monthlyBase,
    processingFee: config.processingFee,
    totalAmount,
    mealCostPrice: config.mealCostPrice,
    deliveryCostPrice: config.deliveryCostPrice,
    addOnsCostPerDay,
    totalCost,
    totalProfit,
    profitMarginPercent,
  };
}

// Generate array of delivery dates for a subscription
export function generateDeliveryDates(
  startDate: Date,
  endDate: Date,
  scheduleType: 'workdays' | 'alldays'
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat

    if (scheduleType === 'workdays') {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(new Date(current));
      }
    } else {
      // All days (Mon–Sat, skip Sundays)
      if (dayOfWeek !== 0) {
        dates.push(new Date(current));
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Generate a unique transaction reference
export function generateTxRef(prefix: string = 'RC'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ─── Dynamic Workday Calculation ──────────────────────────────────────────────
/**
 * Calculate the actual number of workdays (Mon-Fri) in a given month/year
 * @param year - Full year (e.g., 2026)
 * @param month - Month (0-11, where 0=January, 11=December)
 * @returns Number of workdays in that month
 */
export function calculateWorkdaysInMonth(year: number, month: number): number {
  let workdays = 0;
  const date = new Date(year, month, 1);
  
  // Iterate through all days in the month
  while (date.getMonth() === month) {
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workdays++;
    }
    date.setDate(date.getDate() + 1);
  }
  
  return workdays;
}

/**
 * Calculate the actual number of all-days (Mon-Sat, excluding Sundays) in a given month/year
 * @param year - Full year (e.g., 2026)
 * @param month - Month (0-11)
 * @returns Number of all-days in that month
 */
export function calculateAllDaysInMonth(year: number, month: number): number {
  let allDays = 0;
  const date = new Date(year, month, 1);
  
  while (date.getMonth() === month) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0) { // Exclude Sundays only
      allDays++;
    }
    date.setDate(date.getDate() + 1);
  }
  
  return allDays;
}

/**
 * Calculate pricing for a specific month using actual workday count
 */
export function calculatePricingForMonth(
  config: IPricingConfig,
  mealsPerDay: 1 | 2,
  scheduleType: 'workdays' | 'alldays',
  year: number,
  month: number,
  portions: number = 1,
  addOns: AddOnSelection[] = []
): MonthlyPricingBreakdown {
  // Calculate actual delivery days for this specific month
  const deliveryDays = scheduleType === 'workdays' 
    ? calculateWorkdaysInMonth(year, month)
    : calculateAllDaysInMonth(year, month);

  // Find portion pricing (default to base meal price if not found)
  let portionPrice = config.mealPrice;
  let portionCost = config.mealCostPrice;
  
  const selectedPortion = config.portionOptions?.find(p => p.portions === portions);
  if (selectedPortion) {
    portionPrice = selectedPortion.price;
    portionCost = selectedPortion.cost;
  }

  // Selling price calculations
  const addOnsPerDay = addOns.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const mealCostPerDay = portionPrice * mealsPerDay;
  const dailyTotal = mealCostPerDay + config.deliveryFee + addOnsPerDay;
  const monthlyBase = dailyTotal * deliveryDays;
  const totalAmount = monthlyBase + config.processingFee;

  // Cost price calculations (for margin tracking)
  const addOnsCostPerDay = addOns.reduce((sum, item) => {
    const addOnConfig = config.addOns?.find(a => a.name === item.name);
    return sum + ((addOnConfig?.cost || item.price) * item.quantity);
  }, 0);
  const mealCostPerDayActual = portionCost * mealsPerDay;
  const dailyCost = mealCostPerDayActual + config.deliveryCostPrice + addOnsCostPerDay;
  const totalCost = dailyCost * deliveryDays;
  const totalProfit = totalAmount - totalCost;
  const profitMarginPercent = Math.round((totalProfit / totalAmount) * 100);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);

  return {
    mealsPerDay,
    scheduleType,
    deliveryDays,
    mealCostPerDay,
    deliveryFee: config.deliveryFee,
    addOnsPerDay,
    dailyTotal,
    monthlyBase,
    processingFee: config.processingFee,
    totalAmount,
    mealCostPrice: config.mealCostPrice,
    deliveryCostPrice: config.deliveryCostPrice,
    addOnsCostPerDay,
    totalCost,
    totalProfit,
    profitMarginPercent,
    month,
    year,
    monthName: monthNames[month],
    startDate,
    endDate,
  };
}

/**
 * Generate 12-month pricing breakdown starting from a given month
 */
export function generate12MonthBreakdown(
  config: IPricingConfig,
  mealsPerDay: 1 | 2,
  scheduleType: 'workdays' | 'alldays',
  startDate: Date,
  portions: number = 1,
  addOns: AddOnSelection[] = []
): YearlyBreakdown {
  const months: MonthlyPricingBreakdown[] = [];
  let total = 0;
  let minMonth = Infinity;
  let maxMonth = 0;

  // Generate breakdown for next 12 months from startDate
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() + i);
    
    const breakdown = calculatePricingForMonth(
      config,
      mealsPerDay,
      scheduleType,
      monthDate.getFullYear(),
      monthDate.getMonth(),
      portions,
      addOns
    );
    
    months.push(breakdown);
    total += breakdown.totalAmount;
    minMonth = Math.min(minMonth, breakdown.totalAmount);
    maxMonth = Math.max(maxMonth, breakdown.totalAmount);
  }

  return {
    months,
    totalAmount12Months: total,
    averageMonthlyAmount: Math.round(total / 12),
    minMonthAmount: minMonth,
    maxMonthAmount: maxMonth,
  };
}
