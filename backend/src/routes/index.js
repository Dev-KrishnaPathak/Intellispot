import { Router } from 'express';
import authRoutes from './auth.js';
import recommendationRoutes from './recommendations.js';
import feedbackRoutes from './feedback.js';
import contextRoutes from './contextroute.js';

const router = Router();
router.use('/auth', authRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/context', contextRoutes);

export default router;
