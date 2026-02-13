import { Hono } from 'hono';
import { getSettings, updateSettings } from '../controllers/adminController.js';
import { getRecentActivities, getActivityStats } from '../controllers/activityController.js';
import { getAllPatients, getPatientDetail, updatePatientStatus, getPatientStats } from '../controllers/patientController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const adminRoutes = new Hono();

// Settings routes
adminRoutes.get('/settings', authenticate, authorize('admin'), getSettings);
adminRoutes.put('/settings', authenticate, authorize('admin'), updateSettings);

// Activity routes
adminRoutes.get('/activities', authenticate, authorize('admin'), getRecentActivities);
adminRoutes.get('/activities/stats', authenticate, authorize('admin'), getActivityStats);

// Patient management routes
adminRoutes.get('/patients', authenticate, authorize('admin'), getAllPatients);
adminRoutes.get('/patients/stats', authenticate, authorize('admin'), getPatientStats);
adminRoutes.get('/patients/:patientId', authenticate, authorize('admin'), getPatientDetail);
adminRoutes.put('/patients/:patientId/status', authenticate, authorize('admin'), updatePatientStatus);

export default adminRoutes;
