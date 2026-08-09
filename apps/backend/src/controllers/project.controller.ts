import { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  ProjectKickoffError,
  assignProjectSchema,
  createProjectFromDeal,
  createProjectHandoffPayload,
  createProjectSchema,
  getKickoffReadiness,
  getProject,
  listProjects,
  memberSchema,
  projectQuerySchema,
  projectUpdateSchema,
  removeProjectMember,
  statusTransitionSchema,
  transitionProjectStatus,
  updateProject,
  updateProjectAssignment,
  upsertProjectMember,
} from '../services/projectKickoff.service.js';

function handleProjectError(error: unknown, res: Response) {
  if (error instanceof ProjectKickoffError) {
    return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
  }
  return res.status(500).json({ success: false, error: 'Project request failed' });
}

export async function listProjectsController(req: AuthenticatedRequest, res: Response) {
  try {
    const query = projectQuerySchema.parse(req.query);
    res.json({ success: true, data: await listProjects(req.auth!, query) });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function getProjectController(req: AuthenticatedRequest, res: Response) {
  try {
    const project = await getProject(req.auth!, req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, data: project });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function getDealKickoffReadinessController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await getKickoffReadiness(req.auth!, req.params.dealId) });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function createProjectFromDealController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = createProjectSchema.parse(req.body);
    const result = await createProjectFromDeal(req.auth!, req.params.dealId, payload);
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function updateProjectController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = projectUpdateSchema.parse(req.body);
    res.json({ success: true, data: await updateProject(req.auth!, req.params.id, payload) });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function assignProjectController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = assignProjectSchema.parse(req.body);
    res.json({ success: true, data: await updateProjectAssignment(req.auth!, req.params.id, payload) });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function upsertProjectMemberController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = memberSchema.parse(req.body);
    res.json({ success: true, data: await upsertProjectMember(req.auth!, req.params.id, payload) });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function removeProjectMemberController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await removeProjectMember(req.auth!, req.params.id, req.params.memberId) });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function transitionProjectStatusController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = statusTransitionSchema.parse(req.body);
    res.json({ success: true, data: await transitionProjectStatus(req.auth!, req.params.id, payload) });
  } catch (error) {
    handleProjectError(error, res);
  }
}

export async function projectHandoffController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await createProjectHandoffPayload(req.auth!, req.params.id) });
  } catch (error) {
    handleProjectError(error, res);
  }
}
