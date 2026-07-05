import { Router } from 'express';
import {
  createNoteController,
  deleteNoteController,
  listNotesController,
  updateNoteController,
} from '../controllers/note.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', listNotesController);
router.post('/', createNoteController);
router.patch('/:id', updateNoteController);
router.delete('/:id', deleteNoteController);

export default router;
