export const MOCK_SCHEDULES = [
  {
    id: "sched-101",
    planId: "plan-01",
    auditorId: "usr-bhava",
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
    date: new Date().toISOString().split('T')[0],
    shift: "C",
    status: "DONE",
    auditType: "PRODUCT",
    line: "Line 2 - Transmission",
    department: "Machining",
    product: "Gearbox Housing Casing"
  }
];

export const MOCK_CHECKLISTS = {
  PRODUCT: [
    {
      id: "chk-prod-01",
      auditType: "PRODUCT",
      category: "Dimensional",
      description: "Critical dimension verification: Cylinder bore diameter within ±0.015mm tolerance",
      standard: "ISO 2768-mK",
      method: "Bore gauge verification"
    },
    {
      id: "chk-prod-02",
      auditType: "PRODUCT",
      category: "Visual Inspection",
      description: "Surface finish and visual check: Zero burrs, micro-cracks, porosity or casting flash",
      standard: "STD-QA-VIS-04",
      method: "10x Magnifier visual check under 1000 Lux"
    },
    {
      id: "chk-prod-03",
      auditType: "PRODUCT",
      category: "Assembly & Fasteners",
      description: "Fastener torque verification: Cylinder head bolts torqued to 85 Nm ± 2 Nm in sequence",
      standard: "ENG-TRQ-SPEC-12",
      method: "Calibrated digital torque wrench"
    },
    {
      id: "chk-prod-04",
      auditType: "PRODUCT",
      category: "Leak & Pressure",
      description: "Helium / Air pressure decay leak test: Leakage rate <= 0.5 sccm at 3.0 bar",
      standard: "LEAK-TEST-002",
      method: "Automated leak tester station 4"
    },
    {
      id: "chk-prod-05",
      auditType: "PRODUCT",
      category: "Functional Check",
      description: "Crankshaft rotational smoothness: No binding, friction torque under 4.5 Nm",
      standard: "ROT-QA-08",
      method: "Manual rotary gauge spin test"
    }
  ],
  REVALIDATION: [
    {
      id: "chk-reval-01",
      auditType: "REVALIDATION",
      category: "Calibration",
      description: "Verify all shop-floor gauges and digital calipers have valid calibration stickers (< 30 days to expiry)",
      standard: "ISO/IEC 17025",
      method: "Gauge sticker & tool register cross-check"
    },
    {
      id: "chk-reval-02",
      auditType: "REVALIDATION",
      category: "Process Standard",
      description: "SOP displayed at workstation matches current Engineering Change Level (Rev D)",
      standard: "ISO 9001:2015 Clause 8.5",
      method: "Workstation SOP display audit"
    },
    {
      id: "chk-reval-03",
      auditType: "REVALIDATION",
      category: "Process Parameters",
      description: "Coating cure oven temperature profile maintained at 180°C ± 5°C with 20 min dwell",
      standard: "PAINT-SPEC-REV-3",
      method: "SCADA datalogger temperature chart review"
    },
    {
      id: "chk-reval-04",
      auditType: "REVALIDATION",
      category: "Poka-Yoke Challenge",
      description: "Error-proofing poka-yoke sensor challenge: Master defect piece must trigger line stoppage",
      standard: "IATF 16949 8.5.1.5",
      method: "Red-rabbit / challenge part test"
    },
    {
      id: "chk-reval-05",
      auditType: "REVALIDATION",
      category: "First Piece Sign-off",
      description: "Shift first-piece inspection record completed and counter-signed by Quality Engineer",
      standard: "QA-PROC-012",
      method: "Physical QA sign-off sheet audit"
    }
  ]
};
