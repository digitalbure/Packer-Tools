import { UserProfile } from '../types';

/**
 * Reusable role-based helper to check if a user is a super administrator.
 * Custom claims role of "superAdmin" maps to userProfile.isSuperAdmin = true.
 */
export function isSuperAdmin(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.isSuperAdmin === true || user.role === 'owner';
}
