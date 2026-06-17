import type { FC } from "hono/jsx";
import { Button } from "../components/Button.js";

export const NewTaskPage: FC = () => {
  return (
    <div>
      <a href="/app/tasks/mine" class="back-link">
        &larr; Back
      </a>

      <div class="header">
        <h1>New Task</h1>
      </div>

      <div class="card">
        <form method="post" action="/app/tasks">
          <div class="form-group">
            <label class="form-label" for="title">
              Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              class="form-input"
              required
              placeholder="Enter task title..."
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              class="form-input form-textarea"
              placeholder="Enter task description..."
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="priority">
              Priority
            </label>
            <select id="priority" name="priority" class="form-select">
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <Button type="submit" block>
            Create Task
          </Button>
        </form>
      </div>
    </div>
  );
};
