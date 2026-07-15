# MVP Test Checklist

Use this checklist to manually verify TaskPi end-to-end before release.

---

## Team Lifecycle

- [ ] New user can start the bot (`/start`)
- [ ] User with no team sees "Create Team" and "Join Team" buttons
- [ ] User can create a team from Mini App
- [ ] Team creator is automatically assigned the "owner" role
- [ ] Team has a generated invite code

## Membership

- [ ] Admin can view invite code from Mini App
- [ ] Admin can regenerate invite code
- [ ] Another user can request to join using the invite code
- [ ] Duplicate join request is prevented
- [ ] Invalid invite code shows an error
- [ ] Admin sees pending join requests
- [ ] Admin can approve a join request
- [ ] Approved member appears in team members list
- [ ] Approved member receives a Telegram notification
- [ ] Admin can reject a join request
- [ ] Rejected user receives a notification
- [ ] Admin can promote a member to admin
- [ ] Admin can demote an admin to member
- [ ] Admin can remove a member from the team
- [ ] Admin cannot remove the team owner
- [ ] Admin cannot demote the owner
- [ ] Cannot remove or demote the last admin-level user
- [ ] Removed member loses access immediately
- [ ] Removed member's /mytasks shows "no team" state
- [ ] Non-admin member cannot access admin settings
- [ ] Non-admin member cannot view pending join requests
- [ ] Non-admin member cannot regenerate invite code

## Tasks

- [ ] User can create a task from Mini App
- [ ] Task form validates required title
- [ ] Task appears on the board
- [ ] Task can be assigned to a team member (admin only)
- [ ] Non-admin cannot assign tasks
- [ ] Assigned member receives a Telegram notification
- [ ] Task status can be changed (todo → doing → blocked → done)
- [ ] Task can be edited (title, description, priority, due date)
- [ ] Task board shows grouped columns (Todo, Doing, Blocked, Done, Cancelled)
- [ ] Board filters work (assignee, priority)
- [ ] "My Tasks" view shows only user's tasks

## Comments and Activity

- [ ] User can add a comment on a task
- [ ] Comments show author name and timestamp
- [ ] Empty comment shows validation error
- [ ] Task activity feed shows status changes, assignments, comments
- [ ] Team activity page shows membership events

## Notifications

- [ ] Task created → team members notified
- [ ] Task assigned → assignee notified
- [ ] Task status changed → assignee/creator notified
- [ ] Comment added → task assignee/creator notified
- [ ] Join request submitted → admins notified
- [ ] Join request approved → requester notified
- [ ] Join request rejected → requester notified
- [ ] Member removed → removed user notified
- [ ] Notification has a "Open Details" or "Open Board" button

## Authorization

- [ ] User from Team A cannot view Team B's tasks
- [ ] User from Team A cannot view Team B's board
- [ ] User from Team A cannot view Team B's members
- [ ] User from Team A cannot view Team B's activity
- [ ] User without X-User-Id header gets 401
- [ ] Non-member getting team detail gets 403

## Mini App Security

- [ ] Valid signed context renders the page
- [ ] Expired context shows "Link Expired" error page
- [ ] Invalid/tampered context shows error page
- [ ] Missing context token returns 400
- [ ] Session cookie persists for navigation
- [ ] Expired session triggers re-authentication
- [ ] WebApp.ready() and WebApp.expand() called on page load

## Bot Commands

- [ ] `/start` with no team → onboarding buttons
- [ ] `/start` with active team → welcome + menu
- [ ] `/newtask` → Mini App create task link
- [ ] `/mytasks` → task summary
- [ ] `/board` → board summary
- [ ] `/blocked` → blocked tasks list

## Multi-team

- [ ] User can create a second team while already a member of one
- [ ] User can join a second team (approve flow) and see both on `/start`
- [ ] Mini App launch with preferred team opens that board
- [ ] Mini App team switcher (`/app/teams`) updates preferred team
- [ ] **Chores** nav opens teal-styled page (not board columns); create weekly chore assigns member
- [ ] Create chore: how often (always repeats), next due, notify **each cycle** (on/off + offset)
- [ ] Edit cadence updates next due, interval, and per-cycle notification settings
- [ ] Completing a chore advances next due (not a one-time reminder)
- [ ] Chore due notifies assignee via Telegram (`chore_due`); Mark done advances next due
- [ ] Bot `/chores` lists due/upcoming for preferred team
- [ ] Cross-team **My Tasks** (`/app/my-tasks` and bot menu) shows tasks labeled by team
- [ ] Board / New Task operate on preferred or selected team (not silent first membership)
- [ ] Bot **Switch team** callback changes preferred team and re-runs the command
- [ ] Task notification includes team name; deep link opens correct team
- [ ] Opening a task from bot uses task’s teamId (not first membership)
- [ ] `POST /api/tasks` without `X-Team-Id` returns 400
- [ ] `/team` → team overview link
- [ ] `/members` → members list link
- [ ] `/invite` → invite management link
- [ ] All commands show "no team" message when user has no team
- [ ] Menu keyboard buttons work correctly

## Edge Cases

- [ ] User leaves Telegram group → still works in private chat
- [ ] Two users create tasks simultaneously → no conflicts
- [ ] Very long task title → displayed correctly (truncated)
- [ ] Very long comment → displayed with whitespace preserved
- [ ] Empty task description → shows placeholder text
- [ ] Task with no due date → shows "Not set"
- [ ] Task with no assignee → shows "Unassigned"
- [ ] Zero pending join requests → empty state message
- [ ] Zero team activity → empty state message
- [ ] Database file survives API restart

## Deployment Readiness

- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes all tests
- [ ] Health check endpoint working (`GET /health`)
- [ ] Readiness endpoint working (`GET /ready`)
- [ ] Missing env vars cause startup failure with clear message
- [ ] `.env.local` is in `.gitignore`
- [ ] No secrets committed to repository
- [ ] Deployment docs are complete and accurate
