// src/routes/auth.routes.ts

import { Router } from 'express';
import authController from '../controllers/authController.js';

const router = Router();

/**
 * POST /api/auth/register
 * User registration
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', authController.logout);

export default router;
