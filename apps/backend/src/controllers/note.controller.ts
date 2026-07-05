import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createNote,
  deleteNote,
  listNotes,
  noteCreateSchema,
  noteListSchema,
  noteUpdateSchema,
  updateNote,
} from '../services/note.service.js';

export async function listNotesController(req: AuthenticatedRequest, res: Response) {
  try {
    const query = noteListSchema.parse(req.query);
    const data = await listNotes(req.auth!, query);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Related record not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
}

export async function createNoteController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = noteCreateSchema.parse(req.body);
    const data = await createNote(req.auth!, payload);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Related record not found' });
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
}

export async function updateNoteController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = noteUpdateSchema.parse(req.body);
    const data = await updateNote(req.auth!, req.params.id, payload);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
}

export async function deleteNoteController(req: AuthenticatedRequest, res: Response) {
  try {
    const deleted = await deleteNote(req.auth!, req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    res.json({ success: true, message: 'Note deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
}
