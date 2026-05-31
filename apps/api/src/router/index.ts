import { router } from '../trpc.js';
import { orgRouter } from './org.js';
import { projectRouter } from './project.js';
import { boqRouter } from './boq.js';
import { ahspRouter } from './ahsp.js';
import { fleetRouter } from './fleet.js';
import { entryRouter } from './entry.js';
import { dashboardRouter } from './dashboard.js';
import { billingRouter } from './billing.js';
import { inviteRouter } from './invite.js';
import { storageRouter } from './storage.js';
import { boqVersionRouter } from './boq-version.js';
import { exportRouter } from './export.js';
import { intellitracRouter } from './intellitrac.js';
import { adminRouter } from './admin.js';
import { auditRouter } from './audit-view.js';
import { shareRouter } from './share.js';
import { notificationRouter } from './notification.js';
import { onboardingRouter } from './onboarding.js';
import { usageRouter } from './usage.js';
import { webhooksRouter } from './webhooks.js';
import { apiKeysRouter } from './api-keys.js';
import { boqTemplateRouter } from './boq-template.js';
import { pushRouter } from './push.js';
import { domainRouter } from './domain.js';
import { projectMemberRouter } from './project-member.js';
import { maintenanceRouter } from './maintenance.js';
import { gdprRouter } from './gdpr.js';
import { announcementRouter } from './announcement.js';
import { sessionRouter } from './session.js';
import { featureFlagRouter } from './feature-flag.js';
import { scheduleRouter } from './schedule.js';
import { resourceMasterRouter } from './resource-master.js';
import { crewRouter } from './crew.js';
import { hseRouter } from './hse.js';
import { materialRouter } from './material.js';
import { subcontractorRouter } from './subcontractor.js';
import { variationOrderRouter } from './variation-order.js';
import { qcRouter } from './qc.js';
import { weatherRouter } from './weather.js';
import { aiRouter } from './ai.js';
import { errorLogRouter } from './error-log.js';

export const appRouter = router({
  org: orgRouter,
  project: projectRouter,
  boq: boqRouter,
  ahsp: ahspRouter,
  fleet: fleetRouter,
  entry: entryRouter,
  dashboard: dashboardRouter,
  billing: billingRouter,
  invite: inviteRouter,
  storage: storageRouter,
  boqVersion: boqVersionRouter,
  export: exportRouter,
  intellitrac: intellitracRouter,
  admin: adminRouter,
  audit: auditRouter,
  share: shareRouter,
  notification: notificationRouter,
  onboarding: onboardingRouter,
  usage: usageRouter,
  webhooks: webhooksRouter,
  apiKeys: apiKeysRouter,
  boqTemplate: boqTemplateRouter,
  push: pushRouter,
  domain: domainRouter,
  projectMember: projectMemberRouter,
  maintenance: maintenanceRouter,
  gdpr: gdprRouter,
  announcement: announcementRouter,
  session: sessionRouter,
  featureFlag: featureFlagRouter,
  schedule: scheduleRouter,
  resourceMaster: resourceMasterRouter,
  crew: crewRouter,
  hse: hseRouter,
  material: materialRouter,
  subcontractor: subcontractorRouter,
  variationOrder: variationOrderRouter,
  qc: qcRouter,
  weather: weatherRouter,
  ai: aiRouter,
  errorLog: errorLogRouter,
});

export type AppRouter = typeof appRouter;
