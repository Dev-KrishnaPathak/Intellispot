import { Router } from 'express';
import { submitFeedback, submitDetailedFeedback } from '../controllers/feedbackController.js';

const router = Router();
router.post('/', submitFeedback);
router.post('/detailed', submitDetailedFeedback);
export default router;
