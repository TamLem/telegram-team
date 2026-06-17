import { Task, TaskComment, Team, TeamMember, User } from "./types.js";

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

export interface CreateTeamDto {
  name: string;
}

export interface TeamResponse {
  team: Team;
}

export interface TeamsListResponse {
  teams: Team[];
}

export interface AddTeamMemberDto {
  userId: string;
  role?: string;
}

export interface TeamMembersListResponse {
  members: (TeamMember & { user: User })[];
}

export interface CreateCommentDto {
  content: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
