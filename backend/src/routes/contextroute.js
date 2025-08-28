import { Router } from 'express';
import { getContext } from '../controllers/contextcontroller.js';

const router = Router();

router.get('/', getContext);

export default router;
