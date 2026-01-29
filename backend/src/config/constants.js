// Application Constants

export const ROLES = {
  PLATFORM_SUPER_ADMIN: 'platform_super_admin',
  COMPANY_SUPER_ADMIN_PRIMARY: 'company_super_admin_primary',
  COMPANY_SUPER_ADMIN_SECONDARY: 'company_super_admin_secondary',
  COMPANY_ADMIN: 'company_admin',
  EMPLOYEE: 'employee',
};

export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  GRACE_PERIOD: 'grace_period',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
};

export const TRIAL_DURATION_DAYS = 30;

export const SUBSCRIPTION_PLANS = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
};

export const PRICING = {
  MONTHLY: 3999, // ₹3,999/month
  ANNUAL: 39990, // ₹39,990/year (₹3,332.50/month)
};
