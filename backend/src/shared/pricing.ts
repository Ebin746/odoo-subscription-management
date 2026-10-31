// Shared pricing helper
// Owned by P3 (stubbed/aligned for P2 subscription line calculations)

export interface CalculateLineInput {
  quantity: number;
  unitPrice: number | string;
  taxRate?: number | string; // e.g. 18.00 for 18%
}

export interface CalculateLineOutput {
  subtotal: number;
  taxAmount: number;
  amount: number; // subtotal + taxAmount
}

export function calculateLine(input: CalculateLineInput): CalculateLineOutput {
  const qty = Number(input.quantity) || 0;
  const price = Number(input.unitPrice) || 0;
  const tax = Number(input.taxRate) || 0;

  const subtotal = Math.round(qty * price * 100) / 100;
  const taxAmount = Math.round(subtotal * (tax / 100) * 100) / 100;
  const amount = Math.round((subtotal + taxAmount) * 100) / 100;

  return {
    subtotal,
    taxAmount,
    amount,
  };
}
