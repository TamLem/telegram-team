import type { Task, TaskComment, Team, TeamMember, TeamJoinRequest, User } from "./types.js";

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
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  teamId?: string | null;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
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

export interface CreateCommentDto {
  content: string;
}

export interface UserResponse {
  user: User;
}

export interface UserTeamsResponse {
  teams: Team[];
}

export interface MeResponse {
  user: User;
  teams: Team[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}
