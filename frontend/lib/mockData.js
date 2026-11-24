/**
 * AuditPulse 360 - Quality 4.0 Manufacturing Mock & Fallback Database
 * Standardized against IATF 16949 / ISO 9001
 * Provides rich, realistic data for shop-floor inspections, 5-Why CAPA,
 * two-tier approvals, history traceability, and executive analytics.
 */

export const MOCK_SCHEDULES = [
  {
    id: "sched-101",
    planId: "plan-01",
    auditorId: "usr-bhava",
    auditorName: "R. Bhava (Auditor)",
    date: new Date().toISOString().split('T')[0],
    shift: "A",
    status: "PLANNED",
    auditType: "PRODUCT",
    line: "Line 1 - Engine Assembly",
    department: "Assembly",
    product: "V6 Turbo Engine Block"
  },
  {
    id: "sched-102",
    planId: "plan-02",
    auditorId: "usr-bhava",
    auditorName: "R. Bhava (Auditor)",
    date: new Date().toISOString().split('T')[0],
    shift: "B",
    status: "IN_PROGRESS",
    auditType: "REVALIDATION",
    line: "Line 3 - Paint & Coating",
    department: "Paint",
    product: "Chassis Primer Coating"
  },
  {
    id: "sched-103",
    planId: "plan-03",
    auditorId: "usr-bhava",
    auditorName: "R. Bhava (Auditor)",
    date: new Date().toISOString().split('T')[0],
    shift: "C",
    status: "DONE",
    auditType: "PRODUCT",
    line: "Line 2 - Transmission",
    department: "Machining",
    product: "Gearbox Housing Casing"
  },
  {
    id: "sched-104",
    planId: "plan-04",
    auditorId: "usr-bhava",
    auditorName: "R. Bhava (Auditor)",
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    shift: "A",
    status: "DONE",
    auditType: "PRODUCT",
    line: "Line 4 - Battery Pack Assembly",
    department: "Assembly",
    product: "High Voltage Battery Module"
  },
  {
    id: "sched-105",
    planId: "plan-05",
    auditorId: "usr-bhava",
    auditorName: "R. Bhava (Auditor)",
    date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    shift: "B",
    status: "DONE",
    auditType: "REVALIDATION",
    line: "Line 1 - Engine Assembly",
    department: "Assembly",
    product: "Crankshaft Balancing Unit"
  }
];

export const MOCK_CHECKLISTS = {
  PRODUCT: [
    {
      id: "chk-prod-01",
      auditType: "PRODUCT",
      section: "Dimensional",
      itemText: "Critical dimension verification: Cylinder bore diameter within ±0.015mm tolerance",
      standard: "ISO 2768-mK",
      method: "Bore gauge verification"
    },
    {
      id: "chk-prod-02",
      auditType: "PRODUCT",
      section: "Visual Inspection",
      itemText: "Surface finish and visual check: Zero burrs, micro-cracks, porosity or casting flash",
      standard: "STD-QA-VIS-04",
      method: "10x Magnifier visual check under 1000 Lux"
    },
    {
      id: "chk-prod-03",
      auditType: "PRODUCT",
      section: "Fasteners & Torque",
      itemText: "Fastener torque verification: Cylinder head bolts torqued to 85 Nm ± 2 Nm in sequence",
      standard: "ENG-TRQ-SPEC-12",
      method: "Calibrated digital torque wrench"
    },
    {
      id: "chk-prod-04",
      auditType: "PRODUCT",
      section: "Leak & Pressure",
      itemText: "Helium / Air pressure decay leak test: Leakage rate <= 0.5 sccm at 3.0 bar",
      standard: "LEAK-TEST-002",
      method: "Automated leak tester station 4"
    },
    {
      id: "chk-prod-05",
      auditType: "PRODUCT",
      section: "Functional Check",
      itemText: "Crankshaft rotational smoothness: No binding, friction torque under 4.5 Nm",
      standard: "ROT-QA-08",
      method: "Manual rotary gauge spin test"
    }
  ],
  REVALIDATION: [
    {
      id: "chk-reval-01",
      auditType: "REVALIDATION",
      section: "Calibration",
      itemText: "Verify all shop-floor gauges and digital calipers have valid calibration stickers (< 30 days to expiry)",
      standard: "ISO/IEC 17025",
      method: "Gauge sticker & tool register cross-check"
    },
    {
      id: "chk-reval-02",
      auditType: "REVALIDATION",
      section: "Process Standard",
      itemText: "SOP displayed at workstation matches current Engineering Change Level (Rev D)",
      standard: "ISO 9001:2015 Clause 8.5",
      method: "Workstation SOP display audit"
    },
    {
      id: "chk-reval-03",
      auditType: "REVALIDATION",
      section: "Poke-Yoke Verification",
      itemText: "Verify error-proofing sensor trips line stoppage when an unfastened bolt is simulated",
      standard: "POKE-YOKE-03",
      method: "Red rabbit test part challenge"
    }
  ]
};

// Summary metrics matching seed-demo.js (42 schedules, 22 NCs)
export const MOCK_HISTORY_SUMMARY = {
  totalAudits: 42,
  ncsLogged: 22,
  openNcs: 8,
  criticalDefects: 3,
  closedAndVerified: 14,
};

export const MOCK_HISTORY_DATA = [
  {
    id: "sched-hist-01",
    date: "2026-11-20",
    shift: "A",
    auditType: "PRODUCT",
    status: "DONE",
    line: "Line 1 - Engine Assembly",
    department: "Assembly",
    product: "V6 Turbo Engine Block",
    auditor: "R. Bhava (Auditor)",
    totalItems: 16,
    passedCount: 14,
    failedCount: 2,
    score: 87.5,
    ncs: [
      { id: "nc-101", ncNo: "NC-2026-0001", severity: "CRITICAL", status: "CLOSED", remark: "Cylinder bore diameter oversized by +0.028mm on station 3" },
      { id: "nc-102", ncNo: "NC-2026-0002", severity: "MAJOR", status: "CLOSED", remark: "Fastener torque 74 Nm below 85 Nm target on bolt #4" }
    ],
    timelineStage: "STAGE_6_CLOSED"
  },
  {
    id: "sched-hist-02",
    date: "2026-11-19",
    shift: "B",
    auditType: "PRODUCT",
    status: "DONE",
    line: "Line 2 - Transmission Machining",
    department: "Machining",
    product: "Gearbox Housing Casing",
    auditor: "S. Akshiya (Plant Head)",
    totalItems: 15,
    passedCount: 15,
    failedCount: 0,
    score: 100,
    ncs: [],
    timelineStage: "STAGE_6_CLOSED"
  },
  {
    id: "sched-hist-03",
    date: "2026-11-18",
    shift: "C",
    auditType: "REVALIDATION",
    status: "DONE",
    line: "Line 3 - Paint & Coating",
    department: "Paint",
    product: "Chassis Primer Coating",
    auditor: "R. Bhava (Auditor)",
    totalItems: 12,
    passedCount: 10,
    failedCount: 2,
    score: 83.3,
    ncs: [
      { id: "nc-103", ncNo: "NC-2026-0003", severity: "MAJOR", status: "PENDING_APPROVAL", remark: "Dry film primer thickness 18um below minimum specification" },
      { id: "nc-104", ncNo: "NC-2026-0004", severity: "MINOR", status: "CAPA_SUBMITTED", remark: "Workstation SOP rev level obsolete; Rev C instead of Rev D" }
    ],
    timelineStage: "STAGE_5_APPROVAL_PENDING"
  },
  {
    id: "sched-hist-04",
    date: "2026-11-17",
    shift: "A",
    auditType: "PRODUCT",
    status: "DONE",
    line: "Line 4 - Battery Pack Assembly",
    department: "Assembly",
    product: "High Voltage Battery Module",
    auditor: "D. Kaniappan (Audit Head)",
    totalItems: 18,
    passedCount: 17,
    failedCount: 1,
    score: 94.4,
    ncs: [
      { id: "nc-105", ncNo: "NC-2026-0005", severity: "CRITICAL", status: "OPEN", remark: "Thermal interface pad misplaced on cooling plate quadrant 2" }
    ],
    timelineStage: "STAGE_3_NC_OPEN"
  },
  {
    id: "sched-hist-05",
    date: "2026-11-16",
    shift: "B",
    auditType: "PRODUCT",
    status: "DONE",
    line: "Line 1 - Engine Assembly",
    department: "Assembly",
    product: "EV Inverter Power Unit",
    auditor: "R. Bhava (Auditor)",
    totalItems: 14,
    passedCount: 14,
    failedCount: 0,
    score: 100,
    ncs: [],
    timelineStage: "STAGE_6_CLOSED"
  },
  {
    id: "sched-hist-06",
    date: "2026-11-15",
    shift: "A",
    auditType: "REVALIDATION",
    status: "DONE",
    line: "Line 2 - Transmission Machining",
    department: "Machining",
    product: "Differential Pinion Shaft",
    auditor: "S. Akshiya (Plant Head)",
    totalItems: 12,
    passedCount: 11,
    failedCount: 1,
    score: 91.7,
    ncs: [
      { id: "nc-106", ncNo: "NC-2026-0006", severity: "MINOR", status: "CLOSED", remark: "Digital vernier caliper sticker calibration expired by 2 days" }
    ],
    timelineStage: "STAGE_6_CLOSED"
  },
  {
    id: "sched-hist-07",
    date: "2026-11-14",
    shift: "C",
    auditType: "PRODUCT",
    status: "DONE",
    line: "Line 3 - Paint & Coating",
    department: "Paint",
    product: "Bumper Fascia Gloss Coat",
    auditor: "R. Bhava (Auditor)",
    totalItems: 15,
    passedCount: 13,
    failedCount: 2,
    score: 86.7,
    ncs: [
      { id: "nc-107", ncNo: "NC-2026-0007", severity: "MAJOR", status: "REJECTED", remark: "Orange peel texture observed along curvature edge" },
      { id: "nc-108", ncNo: "NC-2026-0008", severity: "MINOR", status: "CLOSED", remark: "Dust inclusion on corner edge < 0.5mm" }
    ],
    timelineStage: "STAGE_4_CAPA_REJECTED"
  },
  {
    id: "sched-hist-08",
    date: "2026-11-13",
    shift: "A",
    auditType: "PRODUCT",
    status: "DONE",
    line: "Line 1 - Engine Assembly",
    department: "Assembly",
    product: "Crankcase Main Bearing",
    auditor: "D. Kaniappan (Audit Head)",
    totalItems: 16,
    passedCount: 16,
    failedCount: 0,
    score: 100,
    ncs: [],
    timelineStage: "STAGE_6_CLOSED"
  },
  {
    id: "sched-hist-09",
    date: "2026-11-12",
    shift: "B",
    auditType: "REVALIDATION",
    status: "DONE",
    line: "Line 4 - Battery Pack Assembly",
    department: "Assembly",
    product: "BMS Wire Harness Route",
    auditor: "R. Bhava (Auditor)",
    totalItems: 14,
    passedCount: 13,
    failedCount: 1,
    score: 92.8,
    ncs: [
      { id: "nc-109", ncNo: "NC-2026-0009", severity: "CRITICAL", status: "CLOSED", remark: "Connector retention clip unlatched on terminal C4" }
    ],
    timelineStage: "STAGE_6_CLOSED"
  },
  {
    id: "sched-hist-10",
    date: "2026-11-11",
    shift: "C",
    auditType: "PRODUCT",
    status: "DONE",
    line: "Line 2 - Transmission Machining",
    department: "Machining",
    product: "Clutch Pressure Plate",
    auditor: "S. Akshiya (Plant Head)",
    totalItems: 15,
    passedCount: 15,
    failedCount: 0,
    score: 100,
    ncs: [],
    timelineStage: "STAGE_6_CLOSED"
  }
];

export const MOCK_APPROVALS_DATA = {
  tier1: [
    {
      id: "nc-103",
      ncNo: "NC-2026-0003",
      severity: "MAJOR",
      line: "Line 3 - Paint & Coating",
      department: "Paint",
      product: "Chassis Primer Coating",
      auditeeName: "K. Linga (Line Owner)",
      createdAt: "2026-11-18T10:30:00Z",
      daysOpen: 3,
      slaHoursLeft: 18,
      remark: "Dry film primer thickness 18um below minimum specification",
      stage: "AUDITOR_VERIFY",
      capa: {
        rootCause: "Atomizer nozzle air-shroud clogged due to delayed solvent flush cycle",
        containment: "Quarantined 45 primed chassis units; recalibrated spray flow rate",
        corrective: "Automated daily solvent flush interlock configured in PLC logic",
        preventive: "Updated TPM maintenance checklist to clean atomizers at start of every shift",
        targetDate: "2026-11-25"
      }
    },
    {
      id: "nc-104",
      ncNo: "NC-2026-0004",
      severity: "MINOR",
      line: "Line 3 - Paint & Coating",
      department: "Paint",
      product: "Chassis Primer Coating",
      auditeeName: "K. Linga (Line Owner)",
      createdAt: "2026-11-18T11:15:00Z",
      daysOpen: 3,
      slaHoursLeft: 42,
      remark: "Workstation SOP rev level obsolete; Rev C instead of Rev D",
      stage: "AUDITOR_VERIFY",
      capa: {
        rootCause: "Quality engineering distributed Rev D via email but laminated floor copy not replaced",
        containment: "Immediately laminated and posted approved Rev D SOP at Station 2",
        corrective: "Established digital document sign-off register with shift supervisor acknowledgment",
        preventive: "Monthly audit of physical workstation documents by quality tech",
        targetDate: "2026-11-23"
      }
    }
  ],
  tier2: [
    {
      id: "nc-101",
      ncNo: "NC-2026-0001",
      severity: "CRITICAL",
      line: "Line 1 - Engine Assembly",
      department: "Assembly",
      product: "V6 Turbo Engine Block",
      auditeeName: "K. Linga (Line Owner)",
      createdAt: "2026-11-20T08:15:00Z",
      daysOpen: 1,
      slaHoursLeft: 12,
      remark: "Cylinder bore diameter oversized by +0.028mm on station 3",
      stage: "QUALITY_HEAD_SIGN_OFF",
      auditorApprovedAt: "2026-11-20T16:45:00Z",
      auditorRemark: "Verified on-site. Tool offset corrected on CNC station 3. Gauge calibration confirmed.",
      capa: {
        rootCause: "CNC boring bar insert experienced premature flank wear beyond 800 cycle limit",
        containment: "Quarantined 14 machined engine blocks; 100% CMM dimensional verification conducted",
        corrective: "CNC tool life limit reduced from 800 cycles to 650 cycles with auto-tool change lock",
        preventive: "Installed acoustic vibration sensor to detect insert micro-chipping in real time",
        targetDate: "2026-11-22"
      }
    },
    {
      id: "nc-107",
      ncNo: "NC-2026-0007",
      severity: "MAJOR",
      line: "Line 3 - Paint & Coating",
      department: "Paint",
      product: "Bumper Fascia Gloss Coat",
      auditeeName: "K. Linga (Line Owner)",
      createdAt: "2026-11-14T14:20:00Z",
      daysOpen: 7,
      slaHoursLeft: 0,
      remark: "Orange peel texture observed along curvature edge",
      stage: "QUALITY_HEAD_SIGN_OFF",
      auditorApprovedAt: "2026-11-19T11:00:00Z",
      auditorRemark: "Re-inspection passed after second trial run with adjusted booth humidity.",
      capa: {
        rootCause: "Paint booth relative humidity dropped to 42% (spec: 65% ± 5%) causing rapid solvent evaporation",
        containment: "Buffed and wet-sanded 8 affected bumper fascias to meet gloss standard",
        corrective: "Humidifier ultrasonic transducer replaced; booth HVAC control loop retuned",
        preventive: "Added automated SMS alert to maintenance team if booth humidity drifts > 3%",
        targetDate: "2026-11-24"
      }
    }
  ]
};

export const MOCK_NCS_DATA = [
  {
    id: "nc-101",
    ncNo: "NC-2026-0001",
    severity: "CRITICAL",
    status: "CLOSED",
    line: "Line 1 - Engine Assembly",
    department: "Assembly",
    product: "V6 Turbo Engine Block",
    auditeeName: "K. Linga (Line Owner)",
    createdAt: "2026-11-20T08:15:00Z",
    remark: "Cylinder bore diameter oversized by +0.028mm on station 3",
    slaDeadline: "2026-11-21T08:15:00Z",
    slaStatus: "MET",
    capa: {
      status: "APPROVED",
      rootCause: "CNC boring bar insert experienced premature flank wear beyond 800 cycle limit",
      containment: "Quarantined 14 machined engine blocks; 100% CMM dimensional verification conducted",
      corrective: "CNC tool life limit reduced from 800 to 650 cycles with auto-tool change lock",
      preventive: "Installed acoustic vibration sensor to detect insert micro-chipping in real time",
      why1: "Why did bore diameter exceed spec? Cutting tool insert wear was excessive.",
      why2: "Why was tool wear excessive? Insert exceeded safe 650-cycle lifespan.",
      why3: "Why did it exceed 650 cycles? CNC machine tool wear counter parameter was set to 800.",
      why4: "Why was parameter set to 800? Old tooling vendor recommended 800 for previous alloy grade.",
      why5: "Why wasn't parameter updated? Engineering Change Notice (ECN) lacked CNC parameter sign-off checklist.",
      targetDate: "2026-11-22"
    }
  },
  {
    id: "nc-102",
    ncNo: "NC-2026-0002",
    severity: "MAJOR",
    status: "CLOSED",
    line: "Line 1 - Engine Assembly",
    department: "Assembly",
    product: "V6 Turbo Engine Block",
    auditeeName: "K. Linga (Line Owner)",
    createdAt: "2026-11-20T09:00:00Z",
    remark: "Fastener torque 74 Nm below 85 Nm target on bolt #4",
    slaDeadline: "2026-11-22T09:00:00Z",
    slaStatus: "MET",
    capa: {
      status: "APPROVED",
      rootCause: "Cordless transducerized nutrunner angle-encoder calibrated with zero offset drift",
      containment: "100% audit of all engines assembled during Shift A using calibrated backup tool",
      corrective: "Tool recalibrated and verified on torque tester station",
      preventive: "Shift-start torque calibration check mandatory before line release",
      targetDate: "2026-11-21"
    }
  },
  {
    id: "nc-103",
    ncNo: "NC-2026-0003",
    severity: "MAJOR",
    status: "PENDING_APPROVAL",
    line: "Line 3 - Paint & Coating",
    department: "Paint",
    product: "Chassis Primer Coating",
    auditeeName: "K. Linga (Line Owner)",
    createdAt: "2026-11-18T10:30:00Z",
    remark: "Dry film primer thickness 18um below minimum specification",
    slaDeadline: "2026-11-20T10:30:00Z",
    slaStatus: "WITHIN_SLA",
    capa: {
      status: "SUBMITTED",
      rootCause: "Atomizer nozzle air-shroud clogged due to delayed solvent flush cycle",
      containment: "Quarantined 45 primed chassis units; recalibrated spray flow rate",
      corrective: "Automated daily solvent flush interlock configured in PLC logic",
      preventive: "Updated TPM maintenance checklist to clean atomizers at start of every shift",
      targetDate: "2026-11-25"
    }
  },
  {
    id: "nc-105",
    ncNo: "NC-2026-0005",
    severity: "CRITICAL",
    status: "OPEN",
    line: "Line 4 - Battery Pack Assembly",
    department: "Assembly",
    product: "High Voltage Battery Module",
    auditeeName: "K. Linga (Line Owner)",
    createdAt: "2026-11-17T11:00:00Z",
    remark: "Thermal interface pad misplaced on cooling plate quadrant 2",
    slaDeadline: "2026-11-18T11:00:00Z",
    slaStatus: "OVERDUE",
    capa: null
  },
  {
    id: "nc-107",
    ncNo: "NC-2026-0007",
    severity: "MAJOR",
    status: "REJECTED",
    line: "Line 3 - Paint & Coating",
    department: "Paint",
    product: "Bumper Fascia Gloss Coat",
    auditeeName: "K. Linga (Line Owner)",
    createdAt: "2026-11-14T14:20:00Z",
    remark: "Orange peel texture observed along curvature edge",
    slaDeadline: "2026-11-16T14:20:00Z",
    slaStatus: "OVERDUE",
    capa: {
      status: "REJECTED",
      rejectionReason: "Proposed action only buffs affected parts; does not address paint viscosity control.",
      rootCause: "Paint booth relative humidity dropped to 42% causing fast flash-off",
      containment: "Buffed and wet-sanded 8 affected bumper fascias",
      corrective: "HVAC humidifier transducer replaced",
      preventive: "Added automated SMS alert on humidity drift",
      targetDate: "2026-11-24"
    }
  }
];

export const MOCK_ANALYTICS_DATA = {
  completion: {
    planned: 42,
    executed: 38,
    percent: 90.5,
    byLine: [
      { line: "Line 1 - Engine Assembly", planned: 15, executed: 14, percent: 93.3 },
      { line: "Line 2 - Transmission Assembly", planned: 12, executed: 12, percent: 100 },
      { line: "Line 3 - Paint & Coating", planned: 8, executed: 6, percent: 75.0 },
      { line: "Line 4 - Battery Pack Assembly", planned: 7, executed: 6, percent: 85.7 },
    ]
  },
  nc: {
    total: 22,
    open: 4,
    inProgress: 3,
    overdue: 2,
    closed: 13,
    critical: 3,
    closureRate: 81.8
  },
  onTimeClosure: {
    percent: 86.7,
    closedOnTime: 13,
    totalClosed: 15
  },
  mttcDays: 3.2,
  aging: {
    lt7: 4,
    d7to15: 3,
    d15to30: 1,
    gt30: 1
  },
  recurringFailures: [
    { item: "Cylinder bore diameter oversized", line: "Line 1 - Engine Assembly", count: 5 },
    { item: "Fastener torque out of spec", line: "Line 1 - Engine Assembly", count: 4 },
    { item: "Primer coating thickness variance", line: "Line 3 - Paint & Coating", count: 3 },
    { item: "Thermal interface pad misplaced", line: "Line 4 - Battery Pack Assembly", count: 2 },
    { item: "Obsolete workstation SOP revision", line: "Line 3 - Paint & Coating", count: 2 }
  ],
  kpis: {
    totalPlanned: 42,
    auditsDone: 38,
    complianceRate: 90.5,
    openNcs: 9,
    criticalNcs: 3,
    mttrDays: 3.2
  },
  pareto: [
    { category: "Dimensional Quality", count: 8, percentage: 36.4, cumulativePercentage: 36.4 },
    { category: "Fastener & Torque", count: 6, percentage: 27.3, cumulativePercentage: 63.7 },
    { category: "Surface & Visual", count: 4, percentage: 18.2, cumulativePercentage: 81.9 },
    { category: "Tool Calibration", count: 2, percentage: 9.1, cumulativePercentage: 91.0 },
    { category: "SOP & Documentation", count: 2, percentage: 9.1, cumulativePercentage: 100.0 }
  ],
  lineCompliance: [
    { line: "Line 1 - Engine Assembly", target: 95, actual: 93.3, status: "PASS" },
    { line: "Line 2 - Transmission Assembly", target: 95, actual: 100.0, status: "PASS" },
    { line: "Line 3 - Paint & Coating", target: 90, actual: 75.0, status: "NEEDS_IMPROVEMENT" },
    { line: "Line 4 - Battery Pack Assembly", target: 98, actual: 85.7, status: "PASS" }
  ],
  monthlyTrend: [
    { month: "Aug", audits: 38, ncs: 18, passRate: 84 },
    { month: "Sep", audits: 40, ncs: 14, passRate: 87 },
    { month: "Oct", audits: 42, ncs: 11, passRate: 91 },
    { month: "Nov", audits: 42, ncs: 7, passRate: 94 }
  ]
};
