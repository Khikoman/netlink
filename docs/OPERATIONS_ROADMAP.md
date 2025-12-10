# NetLink Operations Roadmap

## Vision

Transform NetLink from a network design tool into a **complete FTTH operations platform** that supports the entire lifecycle from planning to customer service.

---

## Current State (v1.0)

### Completed Features
- [x] Canvas-centric network visualization
- [x] Node hierarchy (OLT → ODF → Closure → LCP → NAP)
- [x] Position persistence
- [x] Splice matrix panel
- [x] Fiber color standards (TIA-598)
- [x] Cable configuration
- [x] Basic loss budget calculator
- [x] Edge splice editing

### Limitations
- Design-focused only
- No work order management
- No customer provisioning
- No field operations support
- No inventory tracking
- Single-user, local storage only

---

## Phase 1: Foundation for Operations (v2.0)

**Goal:** Add core infrastructure for multi-user operations

### 1.1 Database Migration to Supabase
- [ ] Migrate from Dexie (IndexedDB) to Supabase (PostgreSQL)
- [ ] Implement real-time sync between users
- [ ] Add authentication (email, SSO)
- [ ] Row-level security for multi-tenant

**Schema Additions:**
```sql
-- Users and organizations
CREATE TABLE organizations (id, name, settings);
CREATE TABLE users (id, org_id, email, role, permissions);

-- Audit trail
CREATE TABLE audit_log (id, user_id, action, entity, entity_id, changes, timestamp);
```

### 1.2 Customer Management
- [ ] Customer database table
- [ ] Service address management
- [ ] Customer ↔ NAP port assignment
- [ ] Service status tracking
- [ ] Customer search/lookup

**New Components:**
```
src/components/customers/
├── CustomerList.tsx
├── CustomerDetail.tsx
├── CustomerSearch.tsx
├── ServiceHistory.tsx
└── AddressLookup.tsx
```

### 1.3 Equipment Registry
- [ ] Serialized equipment tracking (ONTs, splitters)
- [ ] Equipment assignment to customers
- [ ] Equipment status workflow
- [ ] Barcode/QR code scanning support

---

## Phase 2: Work Order Management (v2.5)

**Goal:** Enable field operations tracking

### 2.1 Work Order System
- [ ] Work order creation and assignment
- [ ] Status workflow (Pending → Scheduled → In Progress → Completed)
- [ ] Priority levels and SLA tracking
- [ ] Technician assignment
- [ ] Material requirements per work order

**Work Order Types:**
- New Installation
- Service Restoration
- Maintenance
- Splice Repair
- Equipment Upgrade
- Customer Relocation

### 2.2 Technician Mobile App
- [ ] Progressive Web App (PWA) for offline capability
- [ ] Work order viewing and updates
- [ ] Splice documentation with photo capture
- [ ] GPS location logging
- [ ] Offline queue with sync when connected

**Mobile Components:**
```
src/app/mobile/
├── page.tsx (dashboard)
├── work-orders/
│   ├── page.tsx (list)
│   └── [id]/page.tsx (detail)
├── splice/
│   └── page.tsx (splice capture)
└── offline/
    └── sync.ts
```

### 2.3 Scheduling Dashboard
- [ ] Calendar view of scheduled work
- [ ] Technician availability management
- [ ] Route optimization suggestions
- [ ] Drag-and-drop rescheduling

---

## Phase 3: Inventory & Materials (v3.0)

**Goal:** Complete materials management

### 3.1 Inventory Tracking
- [ ] Stock levels by location (warehouse, van, deployed)
- [ ] Reorder point alerts
- [ ] Material issue/return per work order
- [ ] Inventory transactions history

### 3.2 Equipment Lifecycle
- [ ] ONT tracking from receipt to deployment
- [ ] RMA workflow for defective equipment
- [ ] Equipment audit/reconciliation
- [ ] Depreciation tracking

### 3.3 Purchase Orders
- [ ] PO creation and approval
- [ ] Receiving workflow
- [ ] Vendor management
- [ ] Cost tracking and reporting

---

## Phase 4: Testing & Documentation (v3.5)

**Goal:** Professional-grade documentation

### 4.1 OTDR Integration
- [ ] OTDR trace file import (.sor format)
- [ ] Automatic event detection
- [ ] Pass/fail analysis against standards
- [ ] Trace visualization on canvas

### 4.2 Report Generation
- [ ] Splice closure reports (PDF)
- [ ] As-built documentation packages
- [ ] Customer service records
- [ ] Work order completion reports
- [ ] Excel/CSV exports

### 4.3 Compliance Documentation
- [ ] Configurable acceptance criteria
- [ ] Digital signatures
- [ ] Audit trail for all changes
- [ ] Regulatory report templates

---

## Phase 5: Analytics & Intelligence (v4.0)

**Goal:** Operational insights and optimization

### 5.1 Network Health Dashboard
- [ ] Real-time equipment status
- [ ] Splice quality trends
- [ ] Fiber utilization metrics
- [ ] Problem area identification

### 5.2 Operations Analytics
- [ ] Installation lead time trends
- [ ] Technician productivity
- [ ] First-time fix rate
- [ ] Material usage patterns
- [ ] Cost per installation/repair

### 5.3 Predictive Maintenance
- [ ] Historical failure analysis
- [ ] Proactive maintenance scheduling
- [ ] Weather event correlation
- [ ] Equipment replacement forecasting

---

## Phase 6: Integration Hub (v4.5)

**Goal:** Connect with external systems

### 6.1 Billing Integration
- [ ] Service activation triggers
- [ ] Usage-based billing data
- [ ] Account status sync

### 6.2 CRM Integration
- [ ] Customer data sync
- [ ] Ticket creation from NetLink
- [ ] Service history sharing

### 6.3 GIS Integration
- [ ] Import routes from GIS
- [ ] Export as-built to GIS
- [ ] Address validation
- [ ] Map layer overlays

### 6.4 API Platform
- [ ] RESTful API for all operations
- [ ] Webhook notifications
- [ ] Third-party developer access
- [ ] API documentation

---

## Technical Architecture

### Current (Local-First)
```
Browser → Next.js → Dexie.js → IndexedDB
```

### Target (Cloud-Native)
```
                    ┌─────────────────┐
                    │   Supabase      │
Web Browser ───────→│   (PostgreSQL)  │←──── Mobile PWA
                    │   + Auth        │
                    │   + Realtime    │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ↓                 ↓                 ↓
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ Billing  │      │   CRM    │      │   GIS    │
    │ System   │      │  System  │      │  System  │
    └──────────┘      └──────────┘      └──────────┘
```

### Database Schema Evolution

```sql
-- Phase 1: Foundation
organizations, users, audit_log
customers, service_addresses, customer_equipment

-- Phase 2: Work Orders
work_orders, work_order_items, work_order_notes
technicians, technician_skills, schedules

-- Phase 3: Inventory
inventory_items, inventory_transactions
equipment_registry, equipment_history
purchase_orders, vendors

-- Phase 4: Documentation
otdr_traces, test_results
reports, report_templates
compliance_records, signatures

-- Phase 5: Analytics
metrics_daily, kpi_targets
maintenance_schedules, failure_records

-- Phase 6: Integrations
api_keys, webhooks, integration_configs
sync_logs, external_references
```

---

## Agent Support Matrix

| Agent | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|-------|---------|---------|---------|---------|---------|---------|
| ftth-domain-expert | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| react-flow-specialist | ✓ | ✓ | - | ✓ | ✓ | - |
| dexie-database-specialist | ✓ | → Supabase | - | - | - | - |
| ftth-operations-manager | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| field-technician-assistant | - | ✓ | ✓ | ✓ | - | - |
| network-planner | ✓ | ✓ | - | ✓ | ✓ | - |
| customer-service-agent | ✓ | ✓ | - | - | - | ✓ |
| inventory-manager | - | - | ✓ | - | - | - |
| report-generator | - | - | - | ✓ | ✓ | - |

---

## Estimated Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 4-6 weeks | Supabase migration, auth, customers |
| Phase 2 | 6-8 weeks | Work orders, mobile app, scheduling |
| Phase 3 | 4-6 weeks | Inventory, equipment, purchasing |
| Phase 4 | 4-6 weeks | OTDR, reports, compliance |
| Phase 5 | 4-6 weeks | Dashboards, analytics |
| Phase 6 | 6-8 weeks | API, integrations |

**Total: ~6-9 months to full operations platform**

---

## Success Metrics

### Phase 1 Success
- [ ] Multi-user concurrent editing works
- [ ] Customer lookup < 500ms
- [ ] Zero data loss during migration

### Phase 2 Success
- [ ] Work orders trackable end-to-end
- [ ] Mobile app works offline
- [ ] 80% of field work documented in system

### Phase 3 Success
- [ ] Inventory accuracy > 95%
- [ ] Zero stockouts on critical items
- [ ] Equipment lifecycle fully tracked

### Phase 4 Success
- [ ] OTDR traces importable
- [ ] Reports generated in < 30 seconds
- [ ] Compliance documentation complete

### Phase 5 Success
- [ ] Dashboards update real-time
- [ ] Predictive accuracy > 70%
- [ ] Actionable insights delivered

### Phase 6 Success
- [ ] API 99.9% uptime
- [ ] Integrations sync < 5 min delay
- [ ] Third-party developers building on platform

---

## Getting Started

### Immediate Next Steps

1. **Review this roadmap** with stakeholders
2. **Prioritize phases** based on business needs
3. **Set up Supabase project** for Phase 1
4. **Create detailed specs** for Phase 1 components
5. **Begin migration planning** for existing data

### Commands to Use

```bash
# Use agents for specific tasks
"Use the network-planner agent to design a new service area"
"Use the ftth-operations-manager to plan the work order system"
"Use the field-technician-assistant to design the mobile splice capture"
"Use the inventory-manager to design the stock tracking system"
"Use the report-generator to create report templates"
```

---

*This roadmap is a living document. Update as requirements evolve and phases complete.*
