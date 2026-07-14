import type { Task, TaskComment, TaskEvent, Team, TeamMember, TeamJoinRequest, User } from "./types.js";

export interface CreateTeamDto {
  name: string;
}

export interface JoinTeamDto {
  inviteCode: string;
}

export interface TeamResponse {
  team: Team;
}

export interface TeamMembersListResponse {
  members: (TeamMember & { user: User })[];
}

export interface TeamJoinRequestsListResponse {
  requests: (TeamJoinRequest & { user: User })[];
}

export interface JoinRequestResponse {
  request: TeamJoinRequest;
}

export interface CreateTaskDto {
  title: string;
  description?: string | null;
  priority?: string;
  assignedToUserId?: string | null;
  dueAt?: string | null;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assignedToUserId?: string | null;
  dueAt?: string | null;
}

export interface TaskResponse {
  task: Task;
}

export interface TasksListResponse {
  tasks: Task[];
  total: number;
  limit: number;
  offset: number;
}

export interface BoardColumn {
  status: string;
  label: string;
  tasks: Task[];
  count: number;
}

export interface BoardResponse {
  columns: BoardColumn[];
}

export interface CreateCommentDto {
  body: string;
}

export interface UserResponse {
  user: User;
}

export interface UserTeamsResponse {
  teams: (Team & { role?: string })[];
  preferredTeamId: string | null;
}

export interface MeResponse {
  user: User;
  teams: Team[];
  preferredTeamId: string | null;
}

export interface SetPreferredTeamDto {
  teamId: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
