import { Hono } from "hono";
import { setupAuthRoutes } from "../auth/requireMiniAppUser.js";

const launchRoutes = new Hono();

setupAuthRoutes(launchRoutes);

export { launchRoutes };
