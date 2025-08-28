import { Router } from 'express';
import { adaptRecommendations, recomputeLongTerm } from '../controllers/adaptationController.js';

const router = Router();
router.post('/short-term', adaptRecommendations);
router.post('/long-term', recomputeLongTerm);
export default router;
