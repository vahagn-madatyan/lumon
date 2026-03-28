import { Router } from "express";
import { getEvents, getCostSummary } from "../audit.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /events/:projectId — audit events for a specific project
// ---------------------------------------------------------------------------
router.get("/events/:projectId", (req, res) => {
  const { projectId } = req.params;
  const { since, until, limit, eventType } = req.query;

  const opts = { projectId };
  if (since) opts.since = since;
  if (until) opts.until = until;
  if (limit) opts.limit = parseInt(limit, 10);
  if (eventType) opts.eventType = eventType;

  const events = getEvents(opts);
  res.json(events);
});

// ---------------------------------------------------------------------------
// GET /events — audit events across all projects
// ---------------------------------------------------------------------------
router.get("/events", (req, res) => {
  const { since, until, limit, eventType } = req.query;

  const opts = {};
  if (since) opts.since = since;
  if (until) opts.until = until;
  if (limit) opts.limit = parseInt(limit, 10);
  if (eventType) opts.eventType = eventType;

  const events = getEvents(opts);
  res.json(events);
});

// ---------------------------------------------------------------------------
// GET /cost/:projectId — cost summary for a specific project
// ---------------------------------------------------------------------------
router.get("/cost/:projectId", (req, res) => {
  const summary = getCostSummary(req.params.projectId);
  res.json(summary);
});

// ---------------------------------------------------------------------------
// GET /cost — fleet-wide cost summary
// ---------------------------------------------------------------------------
router.get("/cost", (_req, res) => {
  const summary = getCostSummary();
  res.json(summary);
});

export default router;
