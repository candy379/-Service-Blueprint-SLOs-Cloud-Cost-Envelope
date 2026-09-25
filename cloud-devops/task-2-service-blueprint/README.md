# Task 2 — Service Blueprint, SLOs & Cloud Cost Envelope

## Cloud Computing & DevOps

This project defines the operational contract for a small two-tier web service before infrastructure selection and deployment automation.

The design covers:

* Service request and dependency paths
* Deployment and data flows
* Failure and recovery paths
* Availability and latency SLIs/SLOs
* Error budgets and paging thresholds
* Three traffic and cost scenarios
* Recovery objectives
* Secrets management
* Least-privilege access
* Architecture Decision Records (ADRs)

---

## 1. Architecture

The proposed service uses a two-tier architecture:

```text
                    ┌─────────────────┐
                    │  Client/Browser │
                    └────────┬────────┘
                             │ HTTPS
                             ▼
                    ┌─────────────────┐
                    │ Load Balancer   │
                    │ TLS + Health    │
                    │ Checks          │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   Application Tier       │
              │   Stateless App Tasks    │
              │   2+ instances/tasks     │
              └────────────┬─────────────┘
                           │
                           │ SQL
                           ▼
              ┌──────────────────────────┐
              │ Managed PostgreSQL       │
              │ Transactional Data       │
              └──────────────────────────┘

       ┌─────────────────┐       ┌──────────────────┐
       │ Secrets Manager │       │ CloudWatch       │
       │ DB/API Secrets  │       │ Logs + Metrics   │
       └─────────────────┘       └──────────────────┘

       ┌─────────────────┐       ┌──────────────────┐
       │ Backup Storage  │       │ Container        │
       │ / Snapshots     │       │ Registry         │
       └─────────────────┘       └──────────────────┘
```

### Request Path

Client → HTTPS Load Balancer → Application Tier → PostgreSQL → Application Tier → Load Balancer → Client

### Dependency Path

Application → PostgreSQL
Application → Secrets Manager
Application → CloudWatch

### Deployment Path

Git Repository → CI/CD → Build/Test/Security Scan → Container Registry → Application Deployment

### Data Path

Application → PostgreSQL

Database backups → Managed Backup/Snapshot Storage

### Failure Path

Failure Detection → Alert/Page → Mitigation → Recovery → SLO/Data Verification

---

## 2. SLOs

The service defines three operational scenarios.

| Scenario  | Availability | P95 Latency | Error Budget / 30 Days |    RPO |    RTO |
| --------- | -----------: | ----------: | ---------------------: | -----: | -----: |
| Lean      |        99.0% |      500 ms |                432 min |  24 hr |   4 hr |
| Balanced  |        99.5% |      300 ms |                216 min |   1 hr |   1 hr |
| Resilient |        99.9% |      200 ms |               43.2 min | 15 min | 30 min |

### Availability SLI

Availability is measured as:

```text
Successful valid requests
────────────────────────── × 100
Total valid requests
```

HTTP 5xx responses and timeouts are treated as failures.

### Latency SLI

Latency is measured using server-side request duration.

The primary latency objective is **P95 response time**.

---

## 3. Error Budget

The monthly error budget is based on a 30-day month:

```text
30 × 24 × 60 = 43,200 minutes
```

Therefore:

* 99.0% availability → 432 minutes of allowed unavailability
* 99.5% availability → 216 minutes
* 99.9% availability → 43.2 minutes

Error-budget consumption should be monitored continuously.

---

## 4. Paging Thresholds

### Availability / Error Rate

| Level   | Threshold  | Window    |
| ------- | ---------- | --------- |
| Warning | >1% errors | 5 minutes |
| Page    | >5% errors | 5 minutes |
| Page    | >1% errors | 1 hour    |

### Latency

Page when:

```text
P95 latency > 1.5 × scenario target
```

for approximately 10 consecutive minutes.

### Infrastructure

Page when application CPU/memory or database CPU/connections remain above 85% for approximately 15 minutes.

### Backups

* One failed backup → warning
* Two consecutive failed backups → page

---

## 5. Three-Scenario Cost Model

The monthly planning envelopes are:

| Scenario  | Monthly Budget |
| --------- | -------------: |
| Lean      |         ₹2,500 |
| Balanced  |         ₹8,000 |
| Resilient |        ₹25,000 |

### Lean

Designed for approximately 500 users.

Focus:

* Low infrastructure cost
* Basic availability
* Longer recovery objectives
* Minimal redundancy

### Balanced

Designed for approximately 5,000 users.

Focus:

* Higher application capacity
* Managed database resources
* Better monitoring
* Improved recovery capability
* More operational headroom

### Resilient

Designed for approximately 25,000 users.

Focus:

* Higher availability
* Redundancy
* More aggressive recovery objectives
* Stronger backup/recovery capability
* Greater operational capacity

The detailed cost breakdown is available in:

`SLO-Cost-Envelope.xlsx`

---

## 6. Architecture Decision Records

### ADR-001 — Region

Use AWS Asia Pacific (Hyderabad) as the primary region for an India-focused service.

A documented recovery path to a secondary region should be maintained for the resilient scenario.

### ADR-002 — Two-Tier Architecture

Use a stateless application tier with a managed PostgreSQL database.

This allows application instances to scale independently while keeping persistent data in a managed database service.

### ADR-003 — Recovery Objectives

Recovery objectives are:

* Lean: RPO 24 hours / RTO 4 hours
* Balanced: RPO 1 hour / RTO 1 hour
* Resilient: RPO 15 minutes / RTO 30 minutes

These objectives determine backup frequency, redundancy and recovery procedures.

### ADR-004 — Secrets Management

Application credentials and API secrets must be stored in a managed secrets service.

Secrets must not be committed to GitHub, stored in container images, or placed in plaintext configuration files.

### ADR-005 — Least Privilege

Use separate IAM roles for:

* Application runtime
* CI/CD deployment
* Read-only operations

Permissions should be limited to only the resources and actions required by each role.

### ADR-006 — Failure Management

Failures are handled through:

```text
Detect
  ↓
Alert
  ↓
Mitigate
  ↓
Recover
  ↓
Verify
```

Rollback, scaling and failover procedures should be tested rather than assumed to work.

---

## 7. Failure Recovery

### Application Failure

1. Check load balancer health checks.
2. Check application error rate.
3. Inspect recent deployment.
4. Roll back if necessary.
5. Scale healthy application instances.
6. Verify SLOs.

### Database Failure

1. Check database health.
2. Check connections and CPU.
3. Fail over if configured.
4. Restore according to RPO/RTO.
5. Verify data integrity.

### Traffic Spike

1. Monitor request rate and P95 latency.
2. Allow application autoscaling.
3. Protect the database using connection pooling and limits.
4. Verify that error rate returns below the paging threshold.

### Bad Deployment

1. Stop further deployment.
2. Identify the problematic version.
3. Roll back to the last known-good image.
4. Verify application health.
5. Confirm SLO recovery.

### Backup Failure

1. Investigate the failed backup.
2. Retry or repair the backup process.
3. Page after repeated failures.
4. Perform a restore validation when backup integrity is uncertain.

---

## 8. Project Files

```text
task-2-service-blueprint/
│
├── README.md
├── service-blueprint.png
├── service-blueprint-slo-cost-envelope.docx
└── slo-cost-envelope-workbook.xlsx
```

### Evidence

* `service-blueprint.png` — architecture/service blueprint
* `service-blueprint-slo-cost-envelope.docx` — complete report and ADRs
* `slo-cost-envelope-workbook.xlsx` — SLO, paging and cost model

---

## 9. Official AWS References

* AWS Well-Architected Reliability Pillar
* AWS IAM Security Best Practices
* AWS Secrets Manager Best Practices
* Amazon ECS Service Auto Scaling
* Amazon RDS Backup Documentation
* Amazon RDS Pricing
* Amazon CloudWatch Pricing
* Amazon S3 Pricing
* AWS Backup Pricing
* Elastic Load Balancing Pricing

---

## 10. Conclusion

This operational contract establishes the expected reliability, performance, recovery and cost boundaries of the service before infrastructure and deployment automation are implemented.

The next phase can use these decisions to select the exact AWS services, create infrastructure-as-code, build the CI/CD pipeline and deploy the two-tier application.
