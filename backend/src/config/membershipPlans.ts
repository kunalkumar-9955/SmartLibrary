export interface IMembershipPlan {
  id: string;
  name: string;
  price: number; // in INR
  durationDays: number;
  description: string;
  popular?: boolean;
  features: string[];
}

export const MEMBERSHIP_PLANS: IMembershipPlan[] = [
  {
    id: 'monthly-standard',
    name: 'Monthly Standard Study Pass',
    price: 600,
    durationDays: 30,
    description: 'Full access to general reading hall, high-speed Wi-Fi, and standard study hours (08:00 AM - 10:00 PM).',
    popular: false,
    features: [
      'Access to General Reading Hall',
      'High-Speed Wi-Fi',
      'Daily Smart QR Attendance Tracking',
      'Air Conditioned Study Ambience',
      'Newspaper & Magazine Section',
    ],
  },
  {
    id: 'dedicated-seat',
    name: 'Monthly Dedicated Seat Pass',
    price: 1000,
    durationDays: 30,
    description: 'Guaranteed fixed personal seat with charging point and personal locker access.',
    popular: true,
    features: [
      'Guaranteed Reserved Desk / Seat',
      'Dedicated Power Charging Socket',
      'Personal Locker Facility',
      'High-Speed Wi-Fi & Priority Support',
      'All Standard Study Pass Benefits',
    ],
  },
  {
    id: 'quarterly-pass',
    name: 'Quarterly Dedicated Seat Pass',
    price: 2700,
    durationDays: 90,
    description: '3 Months uninterrupted study with maximum savings and dedicated personal desk.',
    popular: false,
    features: [
      'Fixed Reserved Desk for 90 Days',
      'Personal Locker for 3 Months',
      '10% Long-Term Subscription Discount',
      'Uninterrupted AC & Wi-Fi Access',
      'Priority Help Desk & Support',
    ],
  },
];

export function getPlanById(id: string): IMembershipPlan | undefined {
  return MEMBERSHIP_PLANS.find((plan) => plan.id === id);
}
