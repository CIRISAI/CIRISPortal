/**
 * Tier Badge Component
 *
 * Displays the user's current tier as a colored badge.
 * Pattern: ethicsengine-portal/src/lib/utils.ts badgeStyle()
 */

import { cn } from '@/lib/utils';
import type { TierName } from '@/lib/stripe/tiers';

const TIER_STYLES: Record<
  TierName,
  { bg: string; text: string; label: string }
> = {
  community: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: 'Community',
  },
  professional: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    label: 'Professional',
  },
  enterprise: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    label: 'Enterprise',
  },
  safety_critical: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    label: 'Safety-Critical',
  },
};

interface TierBadgeProps {
  tier: TierName;
  size?: 'sm' | 'md';
  className?: string;
}

export function TierBadge({ tier, size = 'sm', className }: TierBadgeProps) {
  const style = TIER_STYLES[tier] || TIER_STYLES.community;

  return (
    <span
      data-testid={`tier-badge-${tier}`}
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        style.bg,
        style.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
    >
      {style.label}
    </span>
  );
}

/**
 * Compact tier indicator for sidebar.
 */
export function TierIndicator({
  tier,
  showUpgrade = false,
}: {
  tier: TierName;
  showUpgrade?: boolean;
}) {
  return (
    <div data-testid="tier-indicator" className="flex items-center gap-2">
      <TierBadge tier={tier} />
      {showUpgrade && tier === 'community' && (
        <a
          data-testid="btn-sidebar-upgrade"
          href="/pricing"
          className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          Upgrade
        </a>
      )}
    </div>
  );
}
