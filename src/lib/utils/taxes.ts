// BC Canada Tax Calculations (2024 rates)

// Federal Tax Brackets 2024
const FEDERAL_BRACKETS = [
  { min: 0, max: 55867, rate: 0.15 },
  { min: 55867, max: 111733, rate: 0.205 },
  { min: 111733, max: 173205, rate: 0.26 },
  { min: 173205, max: 246752, rate: 0.29 },
  { min: 246752, max: Infinity, rate: 0.33 }
];

// BC Provincial Tax Brackets 2024
const BC_BRACKETS = [
  { min: 0, max: 47937, rate: 0.0506 },
  { min: 47937, max: 95875, rate: 0.077 },
  { min: 95875, max: 110076, rate: 0.105 },
  { min: 110076, max: 133664, rate: 0.1229 },
  { min: 133664, max: 181232, rate: 0.147 },
  { min: 181232, max: Infinity, rate: 0.205 }
];

// CPP 2024
const CPP = {
  rate: 0.0595,
  maxPensionableEarnings: 68500,
  basicExemption: 3500,
  maxContribution: 3867.50
};

// EI 2024
const EI = {
  rate: 0.0163,
  maxInsurableEarnings: 63200,
  maxPremium: 1030.16
};

// Basic Personal Amount (Federal)
const FEDERAL_BPA = 15705;

// BC Basic Personal Amount
const BC_BPA = 12580;

function calculateProgressiveTax(income: number, brackets: typeof FEDERAL_BRACKETS): number {
  let tax = 0;
  let remainingIncome = income;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
    tax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }

  return tax;
}

export function calculateFederalTax(annualIncome: number): number {
  const taxableIncome = Math.max(0, annualIncome - FEDERAL_BPA);
  return calculateProgressiveTax(taxableIncome, FEDERAL_BRACKETS);
}

export function calculateBCTax(annualIncome: number): number {
  const taxableIncome = Math.max(0, annualIncome - BC_BPA);
  return calculateProgressiveTax(taxableIncome, BC_BRACKETS);
}

export function calculateCPP(annualIncome: number): number {
  const pensionableEarnings = Math.min(annualIncome, CPP.maxPensionableEarnings) - CPP.basicExemption;
  if (pensionableEarnings <= 0) return 0;
  return Math.min(pensionableEarnings * CPP.rate, CPP.maxContribution);
}

export function calculateEI(annualIncome: number): number {
  const insurableEarnings = Math.min(annualIncome, EI.maxInsurableEarnings);
  return Math.min(insurableEarnings * EI.rate, EI.maxPremium);
}

export interface TaxBreakdown {
  grossIncome: number;
  federalTax: number;
  provincialTax: number;
  cpp: number;
  ei: number;
  totalDeductions: number;
  netIncome: number;
  effectiveTaxRate: number;
}

export function calculateTaxBreakdown(annualIncome: number): TaxBreakdown {
  const federalTax = calculateFederalTax(annualIncome);
  const provincialTax = calculateBCTax(annualIncome);
  const cpp = calculateCPP(annualIncome);
  const ei = calculateEI(annualIncome);

  const totalDeductions = federalTax + provincialTax + cpp + ei;
  const netIncome = annualIncome - totalDeductions;
  const effectiveTaxRate = annualIncome > 0 ? (totalDeductions / annualIncome) * 100 : 0;

  return {
    grossIncome: annualIncome,
    federalTax,
    provincialTax,
    cpp,
    ei,
    totalDeductions,
    netIncome,
    effectiveTaxRate
  };
}

// Estimate YTD net based on earnings so far
export function estimateYearEndNet(ytdEarnings: number, daysWorkedYTD: number): TaxBreakdown | null {
  if (daysWorkedYTD <= 0) return null;

  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const daysPassed = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysInYear = 365;

  // Project annual income based on average daily earnings
  const avgDailyEarnings = ytdEarnings / daysWorkedYTD;
  const workDaysPerYear = Math.min(daysWorkedYTD * (daysInYear / daysPassed), 260); // Cap at ~260 work days
  const projectedAnnual = avgDailyEarnings * workDaysPerYear;

  return calculateTaxBreakdown(projectedAnnual);
}
