'use client';

/**
 * 7 Pixel Art Agent Avatars — Black & White, 8-bit style
 * Each has distinct hat/headwear + gender presentation
 * Grid-based SVG: each "pixel" is a 4x4 rect on a 64x64 canvas
 */

const P = 4; // pixel size

// Helper: draw a filled pixel at grid position
function px(x: number, y: number, color = '#1a1a1a', prefix = '') {
  return <rect key={`${prefix}${x}-${y}`} x={x * P} y={y * P} width={P} height={P} fill={color} />;
}

let _pixelGroupId = 0;
// Helper: draw multiple pixels from coordinate array
function pixels(coords: [number, number][], color = '#1a1a1a') {
  const gid = _pixelGroupId++;
  return coords.map(([x, y]) => px(x, y, color, `g${gid}-`));
}

function AvatarSvg({ children, size = 64 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="block">
      <rect width="64" height="64" fill="#F5F4ED" rx="8" />
      {children}
    </svg>
  );
}

/** 调度官 Commander — Male, military officer cap with star */
export function AvatarCommander({ size = 64 }: { size?: number }) {
  return (
    <AvatarSvg size={size}>
      {/* Officer cap */}
      {pixels([[5,3],[6,3],[7,3],[8,3],[9,3],[10,3]])}
      {pixels([[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4]])}
      {pixels([[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]])}
      {/* Star on cap */}
      {px(7, 3, '#888')}
      {px(8, 3, '#888')}
      {/* Head */}
      {pixels([[6,6],[7,6],[8,6],[9,6]])}
      {pixels([[5,7],[6,7],[9,7],[10,7]])}
      {/* Eyes */}
      {px(6, 7)}
      {px(9, 7)}
      {/* Mouth — serious line */}
      {pixels([[7,9],[8,9]])}
      {pixels([[5,8],[6,8],[7,8],[8,8],[9,8],[10,8]], '#F5F4ED')}
      {pixels([[6,6],[7,6],[8,6],[9,6]], '#ddd')}
      {/* Neck */}
      {pixels([[7,10],[8,10]])}
      {/* Body — broad shoulders, uniform */}
      {pixels([[4,11],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11]])}
      {pixels([[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12]])}
      {pixels([[4,13],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13]])}
      {pixels([[5,14],[6,14],[7,14],[8,14],[9,14],[10,14]])}
      {/* Epaulettes */}
      {px(4, 11, '#888')}
      {px(11, 11, '#888')}
      {/* Re-draw face */}
      {pixels([[6,6],[7,6],[8,6],[9,6]], '#e8e0d4')}
      {pixels([[5,7],[6,7],[7,7],[8,7],[9,7],[10,7]], '#e8e0d4')}
      {pixels([[5,8],[6,8],[7,8],[8,8],[9,8],[10,8]], '#e8e0d4')}
      {pixels([[6,9],[7,9],[8,9],[9,9]], '#e8e0d4')}
      {/* Eyes */}
      {px(6, 7, '#1a1a1a')}
      {px(9, 7, '#1a1a1a')}
      {/* Stern mouth */}
      {pixels([[7,9],[8,9]], '#1a1a1a')}
    </AvatarSvg>
  );
}

/** 履历分析师 Analyst — Female, round glasses + headband */
export function AvatarAnalyst({ size = 64 }: { size?: number }) {
  return (
    <AvatarSvg size={size}>
      {/* Hair + headband */}
      {pixels([[5,3],[6,3],[7,3],[8,3],[9,3],[10,3]], '#1a1a1a')}
      {pixels([[4,4],[5,4],[10,4],[11,4]], '#1a1a1a')}
      {/* Headband */}
      {pixels([[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]], '#888')}
      {/* Face */}
      {pixels([[5,6],[6,6],[7,6],[8,6],[9,6],[10,6]], '#e8e0d4')}
      {pixels([[5,7],[6,7],[7,7],[8,7],[9,7],[10,7]], '#e8e0d4')}
      {pixels([[5,8],[6,8],[7,8],[8,8],[9,8],[10,8]], '#e8e0d4')}
      {pixels([[6,9],[7,9],[8,9],[9,9]], '#e8e0d4')}
      {/* Round glasses */}
      {px(5, 7, '#1a1a1a')}{px(6, 7, '#1a1a1a')}{px(7, 7, '#1a1a1a')}
      {px(8, 7, '#1a1a1a')}{px(9, 7, '#1a1a1a')}{px(10, 7, '#1a1a1a')}
      {px(6, 7, '#ccc')}{px(9, 7, '#ccc')} {/* lens */}
      {/* Eyes behind glasses */}
      {px(6, 7, '#1a1a1a')}
      {px(9, 7, '#1a1a1a')}
      {/* Slight smile */}
      {px(7, 9, '#1a1a1a')}
      {px(8, 9, '#1a1a1a')}
      {/* Neck */}
      {pixels([[7,10],[8,10]], '#e8e0d4')}
      {/* Body — slender, professional */}
      {pixels([[5,11],[6,11],[7,11],[8,11],[9,11],[10,11]])}
      {pixels([[5,12],[6,12],[7,12],[8,12],[9,12],[10,12]])}
      {pixels([[6,13],[7,13],[8,13],[9,13]])}
      {pixels([[6,14],[7,14],[8,14],[9,14]])}
      {/* Hair sides */}
      {px(4, 5, '#1a1a1a')}{px(4, 6, '#1a1a1a')}{px(4, 7, '#1a1a1a')}
      {px(11, 5, '#1a1a1a')}{px(11, 6, '#1a1a1a')}{px(11, 7, '#1a1a1a')}
    </AvatarSvg>
  );
}

/** 简历顾问 Advisor — Female, beret */
export function AvatarAdvisor({ size = 64 }: { size?: number }) {
  return (
    <AvatarSvg size={size}>
      {/* Beret */}
      {pixels([[6,2],[7,2],[8,2],[9,2]])}
      {pixels([[5,3],[6,3],[7,3],[8,3],[9,3],[10,3]])}
      {pixels([[5,4],[6,4],[7,4],[8,4],[9,4],[10,4]])}
      {/* Beret nub */}
      {px(10, 2, '#1a1a1a')}
      {/* Face */}
      {pixels([[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]], '#e8e0d4')}
      {pixels([[5,6],[6,6],[7,6],[8,6],[9,6],[10,6]], '#e8e0d4')}
      {pixels([[5,7],[6,7],[7,7],[8,7],[9,7],[10,7]], '#e8e0d4')}
      {pixels([[6,8],[7,8],[8,8],[9,8]], '#e8e0d4')}
      {/* Eyes */}
      {px(6, 6, '#1a1a1a')}
      {px(9, 6, '#1a1a1a')}
      {/* Smile */}
      {px(7, 8, '#1a1a1a')}{px(8, 8, '#1a1a1a')}
      {/* Hair flowing down sides */}
      {px(4, 5, '#1a1a1a')}{px(4, 6, '#1a1a1a')}{px(4, 7, '#1a1a1a')}{px(4, 8, '#1a1a1a')}
      {px(11, 5, '#1a1a1a')}{px(11, 6, '#1a1a1a')}{px(11, 7, '#1a1a1a')}{px(11, 8, '#1a1a1a')}
      {/* Pen behind ear */}
      {px(11, 5, '#888')}{px(12, 4, '#888')}{px(12, 3, '#888')}
      {/* Neck */}
      {pixels([[7,9],[8,9]], '#e8e0d4')}
      {/* Body — artistic */}
      {pixels([[5,10],[6,10],[7,10],[8,10],[9,10],[10,10]])}
      {pixels([[5,11],[6,11],[7,11],[8,11],[9,11],[10,11]])}
      {pixels([[6,12],[7,12],[8,12],[9,12]])}
      {pixels([[6,13],[7,13],[8,13],[9,13]])}
    </AvatarSvg>
  );
}

/** 岗位研究员 Scout — Male, explorer/safari hat */
export function AvatarScout({ size = 64 }: { size?: number }) {
  return (
    <AvatarSvg size={size}>
      {/* Safari hat — wide brim */}
      {pixels([[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3]])}
      {pixels([[5,4],[6,4],[7,4],[8,4],[9,4],[10,4]])}
      {pixels([[6,5],[7,5],[8,5],[9,5]])}
      {/* Hat band */}
      {pixels([[5,4],[6,4],[7,4],[8,4],[9,4],[10,4]], '#888')}
      {/* Face */}
      {pixels([[6,6],[7,6],[8,6],[9,6]], '#e8e0d4')}
      {pixels([[5,7],[6,7],[7,7],[8,7],[9,7],[10,7]], '#e8e0d4')}
      {pixels([[5,8],[6,8],[7,8],[8,8],[9,8],[10,8]], '#e8e0d4')}
      {pixels([[6,9],[7,9],[8,9],[9,9]], '#e8e0d4')}
      {/* Eyes — alert */}
      {px(6, 7, '#1a1a1a')}
      {px(9, 7, '#1a1a1a')}
      {/* Slight grin */}
      {px(7, 9, '#1a1a1a')}{px(8, 9, '#1a1a1a')}
      {/* Neck */}
      {pixels([[7,10],[8,10]], '#e8e0d4')}
      {/* Body — adventurer vest */}
      {pixels([[4,11],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11]])}
      {pixels([[4,12],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12]])}
      {pixels([[5,13],[6,13],[7,13],[8,13],[9,13],[10,13]])}
      {/* Vest details */}
      {px(7, 11, '#888')}{px(8, 11, '#888')}
      {px(7, 12, '#888')}{px(8, 12, '#888')}
    </AvatarSvg>
  );
}

/** 匹配审核员 Reviewer — Male, judge's square cap */
export function AvatarReviewer({ size = 64 }: { size?: number }) {
  return (
    <AvatarSvg size={size}>
      {/* Square judge cap */}
      {pixels([[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2]])}
      {pixels([[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3]])}
      {pixels([[6,4],[7,4],[8,4],[9,4]])}
      {/* Tassel */}
      {px(11, 3, '#888')}{px(12, 4, '#888')}{px(12, 5, '#888')}
      {/* Face */}
      {pixels([[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]], '#e8e0d4')}
      {pixels([[5,6],[6,6],[7,6],[8,6],[9,6],[10,6]], '#e8e0d4')}
      {pixels([[5,7],[6,7],[7,7],[8,7],[9,7],[10,7]], '#e8e0d4')}
      {pixels([[6,8],[7,8],[8,8],[9,8]], '#e8e0d4')}
      {/* Eyes — analytical */}
      {px(6, 6, '#1a1a1a')}
      {px(9, 6, '#1a1a1a')}
      {/* Neutral mouth */}
      {pixels([[7,8],[8,8]], '#1a1a1a')}
      {/* Neck */}
      {pixels([[7,9],[8,9]], '#e8e0d4')}
      {/* Body — formal, arms crossed feel */}
      {pixels([[4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10]])}
      {pixels([[4,11],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11]])}
      {pixels([[5,12],[6,12],[7,12],[8,12],[9,12],[10,12]])}
      {pixels([[5,13],[6,13],[7,13],[8,13],[9,13],[10,13]])}
    </AvatarSvg>
  );
}

/** 投递专员 Executor — Female, postal/delivery cap */
export function AvatarExecutor({ size = 64 }: { size?: number }) {
  return (
    <AvatarSvg size={size}>
      {/* Delivery cap */}
      {pixels([[5,3],[6,3],[7,3],[8,3],[9,3],[10,3]])}
      {pixels([[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4]])}
      {/* Cap visor */}
      {pixels([[3,5],[4,5],[5,5],[6,5]], '#888')}
      {/* Hair peek */}
      {px(10, 5, '#1a1a1a')}{px(11, 5, '#1a1a1a')}{px(11, 6, '#1a1a1a')}
      {/* Face */}
      {pixels([[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]], '#e8e0d4')}
      {pixels([[5,6],[6,6],[7,6],[8,6],[9,6],[10,6]], '#e8e0d4')}
      {pixels([[5,7],[6,7],[7,7],[8,7],[9,7],[10,7]], '#e8e0d4')}
      {pixels([[6,8],[7,8],[8,8],[9,8]], '#e8e0d4')}
      {/* Eyes */}
      {px(6, 6, '#1a1a1a')}
      {px(9, 6, '#1a1a1a')}
      {/* Determined smile */}
      {px(7, 8, '#1a1a1a')}{px(8, 8, '#1a1a1a')}
      {/* Neck */}
      {pixels([[7,9],[8,9]], '#e8e0d4')}
      {/* Body — with envelope */}
      {pixels([[5,10],[6,10],[7,10],[8,10],[9,10],[10,10]])}
      {pixels([[5,11],[6,11],[7,11],[8,11],[9,11],[10,11]])}
      {pixels([[6,12],[7,12],[8,12],[9,12]])}
      {/* Envelope in hand */}
      {pixels([[11,11],[12,11],[13,11]], '#888')}
      {pixels([[11,12],[12,12],[13,12]], '#ccc')}
    </AvatarSvg>
  );
}

/** 招聘关系经理 Liaison — Female, elegant wide-brim hat */
export function AvatarLiaison({ size = 64 }: { size?: number }) {
  return (
    <AvatarSvg size={size}>
      {/* Wide elegant hat */}
      {pixels([[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],[12,2]])}
      {pixels([[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3]])}
      {pixels([[5,4],[6,4],[7,4],[8,4],[9,4],[10,4]])}
      {/* Hat ribbon */}
      {pixels([[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3]], '#888')}
      {/* Hair */}
      {px(4, 4, '#1a1a1a')}{px(4, 5, '#1a1a1a')}{px(4, 6, '#1a1a1a')}{px(4, 7, '#1a1a1a')}{px(4, 8, '#1a1a1a')}
      {px(11, 4, '#1a1a1a')}{px(11, 5, '#1a1a1a')}{px(11, 6, '#1a1a1a')}{px(11, 7, '#1a1a1a')}{px(11, 8, '#1a1a1a')}
      {/* Face */}
      {pixels([[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]], '#e8e0d4')}
      {pixels([[5,6],[6,6],[7,6],[8,6],[9,6],[10,6]], '#e8e0d4')}
      {pixels([[5,7],[6,7],[7,7],[8,7],[9,7],[10,7]], '#e8e0d4')}
      {pixels([[6,8],[7,8],[8,8],[9,8]], '#e8e0d4')}
      {/* Eyes — warm */}
      {px(6, 6, '#1a1a1a')}
      {px(9, 6, '#1a1a1a')}
      {/* Warm smile */}
      {px(6, 8, '#1a1a1a')}{px(7, 8, '#1a1a1a')}{px(8, 8, '#1a1a1a')}{px(9, 8, '#1a1a1a')}
      {/* Neck */}
      {pixels([[7,9],[8,9]], '#e8e0d4')}
      {/* Body — diplomatic */}
      {pixels([[5,10],[6,10],[7,10],[8,10],[9,10],[10,10]])}
      {pixels([[5,11],[6,11],[7,11],[8,11],[9,11],[10,11]])}
      {pixels([[6,12],[7,12],[8,12],[9,12]])}
      {/* Extended greeting hand */}
      {pixels([[11,10],[12,10],[13,10]], '#e8e0d4')}
      {px(13, 9, '#e8e0d4')}
    </AvatarSvg>
  );
}

/** Map role_code to avatar component */
export const PIXEL_AVATARS: Record<string, React.FC<{ size?: number }>> = {
  orchestrator: AvatarCommander,
  profile_intelligence: AvatarAnalyst,
  materials_advisor: AvatarAdvisor,
  opportunity_research: AvatarScout,
  matching_review: AvatarReviewer,
  application_executor: AvatarExecutor,
  relationship_manager: AvatarLiaison,
};
