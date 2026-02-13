import { Hono } from 'hono';
import {
  createEmergencyClosure,
  getEmergencyClosures,
  checkEmergencyClosure,
  rescheduleAffectedQueues,
  deactivateEmergencyClosure
} from '../controllers/emergencyController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const emergencyRoutes = new Hono();

// Admin only routes
emergencyRoutes.post('/closure', authenticate, authorize('admin'), createEmergencyClosure);
emergencyRoutes.get('/closures', authenticate, authorize('admin'), getEmergencyClosures);
emergencyRoutes.post('/reschedule', authenticate, authorize('admin'), rescheduleAffectedQueues);
emergencyRoutes.patch('/closure/:emergencyClosureId/deactivate', authenticate, authorize('admin'), deactivateEmergencyClosure);

// Public route to check emergency closure
emergencyRoutes.get('/check-closure', checkEmergencyClosure);

export default emergencyRoutes;
