/**
 * DEEP-WARN-020: Helper to format currency based on tenant settings.
 */
export function formatCurrency(
  amount: number | string,
  currency: string = 'KES',
  locale: string = 'en-KE'
): string {
  const num = typeof amount === 'string' 
    ? parseFloat(amount) : amount;
  
  if (isNaN(num)) return currency + ' 0.00';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
