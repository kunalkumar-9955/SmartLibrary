export interface IMembershipPlan {
  id: string;
  name: string;
  price: number; // strictly 500
  durationDays: number; // 30 days (1 calendar month)
  description: string;
  features: string[];
}

/**
 * EXACTLY ONE MONTHLY MEMBERSHIP PLAN (₹500 ONLY)
 * No multi-tier pricing, no additional plans, no hidden fees.
 */
export const MEMBERSHIP_PLANS: IMembershipPlan[] = [
  {
    id: 'monthly-membership',
    name: 'Monthly Library Membership',
    price: 500,
    durationDays: 30,
    description: 'Full monthly access to study desks, Wi-Fi, and attendance tracking.',
    features: [
      'Full Day Library Study Access (08:00 AM - 10:00 PM)',
      'High-Speed Wi-Fi & Power Sockets',
      'Daily Smart QR Attendance Tracking',
      'Peaceful Air-Conditioned Ambience',
      '5-Day Renewal Grace Period Protection',
    ],
  },
];

export function getPlanById(id?: string): IMembershipPlan {
  // Always return the standard ₹500 monthly plan
  return MEMBERSHIP_PLANS[0];
}
