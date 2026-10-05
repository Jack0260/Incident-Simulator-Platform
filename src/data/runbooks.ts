import type { Runbook } from '@/types';

export const RUNBOOKS: Runbook[] = [
  {
    id: 'rb-db-saturation',
    title: 'Database Saturation Response',
    scenarioType: 'database_saturation',
    description:
      'Runbook for responding to database connection pool exhaustion and query saturation.',
    steps: [
      { order: 1, action: 'Post status page update acknowledging the incident', expectedImpact: 'Sets customer expectations, reduces support load', timeEstimate: '1 min' },
      { order: 2, action: 'Run diagnostic query to identify long-running queries and connection holders', expectedImpact: 'Reveals root cause: runaway queries holding connections', timeEstimate: '2 min' },
      { order: 3, action: 'Enable rate limiting on API gateway to reduce incoming query volume', expectedImpact: 'Reduces pressure on connection pool by 20-30%', timeEstimate: '2 min' },
      { order: 4, action: 'Roll back the release that introduced the problematic query', expectedImpact: 'Eliminates the source of long-running queries, pool utilization drops', timeEstimate: '3 min' },
      { order: 5, action: 'Monitor connection pool utilization and error rates for confirmation', expectedImpact: 'Verify recovery — pool should drop below 70%, errors below 0.1%', timeEstimate: '5 min' },
    ],
    escalationContacts: [
      { role: 'Database On-Call', contact: 'PagerDuty: DB-Primary' },
      { role: 'Backend Lead', contact: 'Slack: #backend-oncall' },
      { role: 'Infrastructure', contact: 'Slack: #infra-ops' },
    ],
  },
  {
    id: 'rb-dependency-outage',
    title: 'Third-Party Dependency Outage',
    scenarioType: 'dependency_outage',
    description:
      'Runbook for responding to outages in external service dependencies.',
    steps: [
      { order: 1, action: 'Post status page update for affected service', expectedImpact: 'Notifies customers, reduces support tickets', timeEstimate: '1 min' },
      { order: 2, action: 'Run diagnostics to identify which dependency is failing', expectedImpact: 'Confirms the failing service and error pattern', timeEstimate: '2 min' },
      { order: 3, action: 'Escalate to vendor support with incident details', expectedImpact: 'Opens communication channel with provider, may get ETA', timeEstimate: '5-10 min' },
      { order: 4, action: 'Enable feature flag kill switch for affected integration', expectedImpact: 'Stops calls to failing dependency, degrades gracefully', timeEstimate: '1 min' },
      { order: 5, action: 'Fail over to secondary/backup provider if available', expectedImpact: 'Restores functionality through alternate path', timeEstimate: '5 min' },
      { order: 6, action: 'Monitor error rates and confirm graceful degradation', expectedImpact: 'Verify customer impact is minimized', timeEstimate: '5 min' },
    ],
    escalationContacts: [
      { role: 'Integration Owner', contact: 'PagerDuty: Integrations' },
      { role: 'Vendor Support', contact: 'Support ticket via vendor portal' },
      { role: 'Incident Commander', contact: 'Slack: #incident-response' },
    ],
  },
  {
    id: 'rb-region-latency',
    title: 'Region-Level Latency Spike',
    scenarioType: 'region_latency_spike',
    description:
      'Runbook for responding to latency degradation isolated to a specific region.',
    steps: [
      { order: 1, action: 'Post status page update for affected region', expectedImpact: 'Notifies affected users, sets expectations', timeEstimate: '1 min' },
      { order: 2, action: 'Run diagnostics to identify if issue is app, network, or database', expectedImpact: 'Reveals cross-region network path degradation', timeEstimate: '2 min' },
      { order: 3, action: 'Fail over affected region traffic to healthy region', expectedImpact: 'Redirects users to region with normal latency', timeEstimate: '5 min' },
      { order: 4, action: 'Verify latency normalizes for affected users', expectedImpact: 'Confirms P95 latency returns to baseline', timeEstimate: '3 min' },
      { order: 5, action: 'Investigate root cause of network degradation with cloud provider', expectedImpact: 'Prevents recurrence — may require peering changes', timeEstimate: 'Post-incident' },
    ],
    escalationContacts: [
      { role: 'Network On-Call', contact: 'PagerDuty: Network' },
      { role: 'Cloud Provider', contact: 'AWS/GCP support ticket' },
      { role: 'Traffic Engineering', contact: 'Slack: #traffic-eng' },
    ],
  },
  {
    id: 'rb-bad-deployment',
    title: 'Bad Deployment Response',
    scenarioType: 'bad_deployment',
    description:
      'Runbook for responding to incidents caused by a recent deployment.',
    steps: [
      { order: 1, action: 'Post status page update', expectedImpact: 'Notifies customers of known issue', timeEstimate: '1 min' },
      { order: 2, action: 'Run diagnostics to confirm deployment correlation', expectedImpact: 'Confirms errors started with last deploy, identifies memory leak pattern', timeEstimate: '2 min' },
      { order: 3, action: 'Roll back to previous deployment version', expectedImpact: 'Eliminates the faulty code, metrics begin recovering', timeEstimate: '3 min' },
      { order: 4, action: 'Monitor error rates, memory, and latency post-rollback', expectedImpact: 'Confirms rollback resolved the issue', timeEstimate: '5 min' },
      { order: 5, action: 'Add canary deployment checks to CI/CD pipeline', expectedImpact: 'Prevents future bad deploys from reaching production', timeEstimate: 'Post-incident' },
    ],
    escalationContacts: [
      { role: 'Deploy On-Call', contact: 'PagerDuty: Deploy' },
      { role: 'Service Owner', contact: 'Slack: #service-owner' },
      { role: 'CI/CD Team', contact: 'Slack: #platform-eng' },
    ],
  },
  {
    id: 'rb-queue-backlog',
    title: 'Queue Backlog Response',
    scenarioType: 'queue_backlog',
    description:
      'Runbook for responding to unbounded message queue growth and consumer lag.',
    steps: [
      { order: 1, action: 'Post status page update for delayed processing', expectedImpact: 'Sets expectations for delayed notifications/processing', timeEstimate: '1 min' },
      { order: 2, action: 'Run diagnostics to check consumer count and processing speed', expectedImpact: 'Reveals reduced consumer count as root cause', timeEstimate: '2 min' },
      { order: 3, action: 'Increase queue workers to restore processing capacity', expectedImpact: 'Drains backlog faster, reduces consumer lag', timeEstimate: '1.5 min' },
      { order: 4, action: 'Roll back config change that reduced consumer count', expectedImpact: 'Restores normal consumer count, prevents recurrence', timeEstimate: '3 min' },
      { order: 5, action: 'Monitor queue depth until backlog is cleared', expectedImpact: 'Confirms queue returns to normal depth', timeEstimate: '10 min' },
    ],
    escalationContacts: [
      { role: 'Queue On-Call', contact: 'PagerDuty: Queue-Primary' },
      { role: 'Messaging Team', contact: 'Slack: #messaging' },
      { role: 'Config Management', contact: 'Slack: #config-mgmt' },
    ],
  },
  {
    id: 'rb-credential-expiration',
    title: 'Credential Expiration Response',
    scenarioType: 'credential_expiration',
    description:
      'Runbook for responding to authentication failures caused by expired credentials or certificates.',
    steps: [
      { order: 1, action: 'Post status page update for auth issues', expectedImpact: 'Notifies customers of intermittent auth failures', timeEstimate: '1 min' },
      { order: 2, action: 'Run diagnostics to identify auth failure pattern and cert status', expectedImpact: 'Reveals expired certificate as root cause', timeEstimate: '2 min' },
      { order: 3, action: 'Escalate to security/infra team for cert renewal', expectedImpact: 'Initiates cert renewal process', timeEstimate: '5-10 min' },
      { order: 4, action: 'Enable kill switch for affected auth path if possible', expectedImpact: 'Reduces error rate while cert is being renewed', timeEstimate: '1 min' },
      { order: 5, action: 'Verify cert renewal and monitor auth success rates', expectedImpact: 'Confirms auth failures stop after renewal', timeEstimate: '5 min' },
      { order: 6, action: 'Set up cert expiry monitoring and alerts', expectedImpact: 'Prevents future credential expiration incidents', timeEstimate: 'Post-incident' },
    ],
    escalationContacts: [
      { role: 'Security On-Call', contact: 'PagerDuty: Security' },
      { role: 'Platform Security', contact: 'Slack: #platform-security' },
      { role: 'Cert Authority', contact: 'ACME provider support' },
    ],
  },
  {
    id: 'rb-disk-exhaustion',
    title: 'Disk Exhaustion Response',
    scenarioType: 'disk_exhaustion',
    description:
      'Runbook for responding to disk space exhaustion on service nodes.',
    steps: [
      { order: 1, action: 'Post status page update', expectedImpact: 'Notifies customers of potential service degradation', timeEstimate: '1 min' },
      { order: 2, action: 'Run diagnostics to identify disk usage source', expectedImpact: 'Reveals abnormal log volume from TRACE logging', timeEstimate: '2 min' },
      { order: 3, action: 'Enable kill switch to disable verbose logging', expectedImpact: 'Stops the source of excessive log generation', timeEstimate: '1 min' },
      { order: 4, action: 'Roll back deployment that enabled TRACE logging', expectedImpact: 'Restores normal log levels, disk usage begins dropping', timeEstimate: '3 min' },
      { order: 5, action: 'Verify disk usage decreasing and writes succeeding', expectedImpact: 'Confirms disk pressure relieved', timeEstimate: '3 min' },
    ],
    escalationContacts: [
      { role: 'Infrastructure On-Call', contact: 'PagerDuty: Infra' },
      { role: 'Logging Team', contact: 'Slack: #observability' },
      { role: 'Service Owner', contact: 'Slack: #service-owner' },
    ],
  },
  {
    id: 'rb-traffic-spike',
    title: 'Traffic Spike Response',
    scenarioType: 'traffic_spike',
    description:
      'Runbook for responding to sudden traffic surges that overwhelm service capacity.',
    steps: [
      { order: 1, action: 'Post status page update for degraded performance', expectedImpact: 'Notifies customers of slow response times', timeEstimate: '1 min' },
      { order: 2, action: 'Run diagnostics to determine if traffic is legitimate or attack', expectedImpact: 'Confirms viral traffic, not DDoS — no malicious pattern', timeEstimate: '2 min' },
      { order: 3, action: 'Scale service horizontally to handle increased load', expectedImpact: 'Adds capacity, reduces per-instance load', timeEstimate: '2 min' },
      { order: 4, action: 'Add rate limiting to protect backend services', expectedImpact: 'Caps incoming load, prevents cascading failures', timeEstimate: '2 min' },
      { order: 5, action: 'Monitor latency and error rates as traffic stabilizes', expectedImpact: 'Confirms services handling load adequately', timeEstimate: '5 min' },
    ],
    escalationContacts: [
      { role: 'Capacity On-Call', contact: 'PagerDuty: Capacity' },
      { role: 'Traffic Engineering', contact: 'Slack: #traffic-eng' },
      { role: 'Autoscaling Team', contact: 'Slack: #platform-eng' },
    ],
  },
];
