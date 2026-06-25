import { TeamRole, type TeamMember, type TeamJoinRequest } from "@telegram-team/shared";

export function getUserRole(member: TeamMember): string {
  return member.role;
}

export function isAdminOrOwner(role: string): boolean {
  return role === TeamRole.ADMIN || role === TeamRole.OWNER;
}

export function isOwner(role: string): boolean {
  return role === TeamRole.OWNER;
}

export function requireTeamMember(
  member: TeamMember | undefined
): TeamMember {
  if (!member) {
    throw new Error("You are not a member of this team");
  }
  return member;
}

export function requireAdmin(
  member: TeamMember | undefined
): TeamMember {
  if (!member) {
    throw new Error("You are not a member of this team");
  }
  if (!isAdminOrOwner(member.role)) {
    throw new Error("Admin access required");
  }
  return member;
}

export function canManageTeam(member: TeamMember): boolean {
  return isAdminOrOwner(member.role);
}

export function canApproveJoinRequest(member: TeamMember): boolean {
  return isAdminOrOwner(member.role);
}

export function canCreateTask(member: TeamMember): boolean {
  return true;
}

export function canUpdateTask(
  member: TeamMember,
  taskCreatedById: string,
  taskAssignedToUserId: string | null
): boolean {
  if (isAdminOrOwner(member.role)) return true;
  if (member.userId === taskCreatedById) return true;
  if (member.userId === taskAssignedToUserId) return true;
  return false;
}

export function canDeleteTask(
  member: TeamMember,
  taskCreatedById: string
): boolean {
  if (isAdminOrOwner(member.role)) return true;
  if (member.userId === taskCreatedById) return true;
  return false;
}
