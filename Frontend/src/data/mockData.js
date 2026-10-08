// ── Projects with lat/lng for maps ────────────────────────
export const mockProjects = [
  { id:'PRJ-001', name:'Amazon Reforestation Initiative',   type:'Reforestation',  ngo:'EcoGuard Brazil',   location:'Amazonas, Brazil',        lat:-3.4653, lng:-62.2159, status:'approved', credits:12400, price:28.50, area:4500,  trees:180000, plantType:'Tropical Broadleaf', startDate:'2024-01-15', mrvScore:94, fraudRisk:8,  envScore:91 },
  { id:'PRJ-002', name:'Sundarbans Mangrove Restoration',   type:'Mangrove',       ngo:'Green Delta',       location:'West Bengal, India',       lat:21.9497, lng:88.9468,  status:'pending',  credits:8200,  price:26.00, area:2100,  trees:95000,  plantType:'Mangrove',           startDate:'2024-03-10', mrvScore:87, fraudRisk:12, envScore:88 },
  { id:'PRJ-003', name:'Congo Basin Forest Shield',         type:'Reforestation',  ngo:'CongoCare',         location:'DRC, Africa',              lat:-0.2280, lng:25.5560,  status:'approved', credits:22000, price:29.75, area:7800,  trees:312000, plantType:'Tropical Hardwood',  startDate:'2023-11-01', mrvScore:91, fraudRisk:9,  envScore:93 },
  { id:'PRJ-004', name:'Borneo Peat Restoration',           type:'Carbon Capture', ngo:'Borneo Earth',      location:'Kalimantan, Indonesia',    lat:0.9619,  lng:114.5548, status:'rejected', credits:0,     price:0,     area:1800,  trees:0,      plantType:'Peatland Mosses',    startDate:'2024-02-20', mrvScore:41, fraudRisk:72, envScore:40 },
  { id:'PRJ-005', name:'Vietnamese Coastal Mangrove',       type:'Mangrove',       ngo:'MekongGreen',       location:'Mekong Delta, Vietnam',    lat:9.5947,  lng:105.9740, status:'approved', credits:6800,  price:26.00, area:900,   trees:54000,  plantType:'Mangrove',           startDate:'2024-06-01', mrvScore:88, fraudRisk:11, envScore:86 },
  { id:'PRJ-006', name:'Methane Capture Bihar',             type:'Methane',        ngo:'CleanIndia NGO',    location:'Bihar, India',             lat:25.0961, lng:85.3131,  status:'approved', credits:9400,  price:24.50, area:0,     trees:0,      plantType:'N/A',                startDate:'2024-04-15', mrvScore:82, fraudRisk:18, envScore:79 },
  { id:'PRJ-007', name:'Chilean Solar Valley',              type:'Renewable',      ngo:'AndesSolar',        location:'Atacama, Chile',           lat:-24.5000,lng:-69.2500, status:'pending',  credits:18000, price:33.00, area:0,     trees:0,      plantType:'N/A',                startDate:'2024-07-01', mrvScore:95, fraudRisk:5,  envScore:92 },
  { id:'PRJ-008', name:'Kenya Agroforestry Belt',           type:'Agroforestry',   ngo:'EcoGuard Brazil',   location:'Rift Valley, Kenya',       lat:-0.3031, lng:36.0800,  status:'approved', credits:5600,  price:27.00, area:1200,  trees:48000,  plantType:'Acacia + Food Crops', startDate:'2024-05-20', mrvScore:89, fraudRisk:7,  envScore:88 },
];

export const mockUsers = [
  { id:1, name:'EcoGuard Brazil',        email:'contact@ecoguard.org',       role:'ngo',   projects:3, credits:34600, joined:'2023-06-12', status:'active' },
  { id:2, name:'Microsoft Sustainability',email:'carbon@microsoft.com',      role:'buyer', projects:0, credits:15200, joined:'2023-09-01', status:'active' },
  { id:3, name:'Google Carbon Team',     email:'sustainability@google.com',  role:'buyer', projects:0, credits:28000, joined:'2023-07-14', status:'active' },
  { id:4, name:'Green Delta',            email:'info@greendelta.org',        role:'ngo',   projects:2, credits:8200,  joined:'2024-01-05', status:'active' },
  { id:5, name:'Shell Renewables',       email:'offsets@shell.com',          role:'buyer', projects:0, credits:42000, joined:'2023-04-22', status:'active' },
  { id:6, name:'Borneo Earth',           email:'team@borneoearth.org',       role:'ngo',   projects:1, credits:0,     joined:'2024-03-08', status:'suspended' },
  { id:7, name:'HSBC Green Finance',     email:'carbon@hsbc.com',           role:'buyer', projects:0, credits:9800,  joined:'2024-02-17', status:'active' },
  { id:8, name:'CongoCare',             email:'ops@congocare.org',          role:'ngo',   projects:2, credits:22000, joined:'2023-11-30', status:'active' },
];

export const mockTransactions = [
  { id:1, buyer:'Microsoft Sustainability', project:'Amazon Reforestation Initiative', projectId:'PRJ-001', tons:2000, price:28.50, total:57000,  date:'2024-12-15', cert:'CV-2024-001' },
  { id:2, buyer:'Google Carbon Team',       project:'Congo Basin Forest Shield',       projectId:'PRJ-003', tons:5000, price:29.75, total:148750, date:'2024-12-14', cert:'CV-2024-002' },
  { id:3, buyer:'Shell Renewables',         project:'Congo Basin Forest Shield',       projectId:'PRJ-003', tons:8000, price:29.75, total:238000, date:'2024-12-12', cert:'CV-2024-003' },
  { id:4, buyer:'HSBC Green Finance',       project:'Vietnamese Coastal Mangrove',     projectId:'PRJ-005', tons:1200, price:26.00, total:31200,  date:'2024-12-10', cert:'CV-2024-004' },
  { id:5, buyer:'Microsoft Sustainability', project:'Chilean Solar Valley',            projectId:'PRJ-007', tons:3000, price:33.00, total:99000,  date:'2024-12-08', cert:'CV-2024-005' },
];

// Corporate buy requests shown in NGO marketplace
export const mockBuyRequests = [
  { id:'REQ-001', buyer:'Microsoft Sustainability', project:'Amazon Reforestation Initiative', projectId:'PRJ-001', tons:1500, pricePerTon:28.50, total:42750, date:'2024-12-18', status:'pending' },
  { id:'REQ-002', buyer:'Google Carbon Team',       project:'Kenya Agroforestry Belt',         projectId:'PRJ-008', tons:2000, pricePerTon:27.00, total:54000, date:'2024-12-17', status:'pending' },
  { id:'REQ-003', buyer:'Shell Renewables',         project:'Amazon Reforestation Initiative', projectId:'PRJ-001', tons:3000, pricePerTon:29.00, total:87000, date:'2024-12-16', status:'pending' },
  { id:'REQ-004', buyer:'HSBC Green Finance',       project:'Vietnamese Coastal Mangrove',     projectId:'PRJ-005', tons:800,  pricePerTon:26.00, total:20800, date:'2024-12-15', status:'accepted' },
];

export const mockCreditsOverTime = [
  {month:'Jul',credits:18000},{month:'Aug',credits:24000},
  {month:'Sep',credits:31000},{month:'Oct',credits:28000},
  {month:'Nov',credits:45000},{month:'Dec',credits:52000},
];

export const mockCreditsByType = [
  {name:'Reforestation',value:49400},{name:'Renewable',value:49000},
  {name:'Methane',value:9400},{name:'Carbon Capture',value:0},
];

export const mockResilienceData = [
  {metric:'Flood Control',score:78},{metric:'Biodiversity',score:85},
  {metric:'Fisheries',score:62},{metric:'Coastal Prot.',score:71},
  {metric:'Carbon Seq.',score:93},{metric:'Livelihood',score:67},
];

export const mockNotifications = [
  {id:1,type:'approval',title:'Project Approved',   message:'Amazon Reforestation Initiative has been approved', time:'5m ago', read:false},
  {id:2,type:'warning', title:'High Fraud Risk',    message:'Borneo Peat flagged with 72% fraud risk',           time:'1h ago', read:false},
  {id:3,type:'success', title:'Credits Minted',     message:'6,800 credits minted for Vietnamese Mangrove',      time:'3h ago', read:true},
  {id:4,type:'info',    title:'Buy Request Received',message:'Microsoft wants 1,500 credits from PRJ-001',        time:'2h ago', read:false},
  {id:5,type:'success', title:'Sale Completed',     message:'HSBC purchased 800 credits — ₹17,47,200 received',  time:'1d ago', read:true},
];

export const mockPricing = { base:28.50, demand:1.12, supply:0.98, living:1.08 };

export const mockGRSData = {
  score:847, transparency:92, quality:88, commitment:79, verification:95,
  badge:'Gold Verifier', rank:4, total:148,
};

export const demoAccounts = [
  {role:'admin',  admin_role:'super_admin', email:'admin@carbonvault.com', name:'Alex Mercer', org:'CarbonVault HQ'},
  {role:'admin',  admin_role:'approver',    email:'approver@carbonvault.com', name:'Sarah Jenkins', org:'CarbonVault Verifications'},
  {role:'ngo',    email:'ngo@carbonvault.com',   name:'Maria Santos',org:'EcoGuard Brazil'},
  {role:'corporate', email:'corp@carbonvault.com', name:'James Chen', org:'Microsoft Sustainability'},
];

// Marketplace listings (for corporate buyer view)
export const mockMarketplace = [
  {id:'PRJ-001',name:'Amazon Reforestation Initiative',  type:'Reforestation', location:'Amazonas, Brazil',      credits:8200,  area:4500,  price:28.50, ngo:'EcoGuard Brazil',   verified:94},
  {id:'PRJ-003',name:'Congo Basin Forest Shield',        type:'Reforestation', location:'DRC, Africa',           credits:18000, area:7800,  price:29.75, ngo:'CongoCare',         verified:91},
  {id:'PRJ-005',name:'Vietnamese Coastal Mangrove',      type:'Mangrove',      location:'Mekong Delta, Vietnam', credits:3200,  area:900,   price:26.00, ngo:'MekongGreen',       verified:88},
  {id:'PRJ-006',name:'Methane Capture Bihar',            type:'Methane',       location:'Bihar, India',          credits:5400,  area:0,     price:24.50, ngo:'CleanIndia NGO',    verified:82},
  {id:'PRJ-007',name:'Chilean Solar Valley',             type:'Renewable',     location:'Atacama, Chile',        credits:0,     area:0,     price:33.00, ngo:'AndesSolar',        verified:95},
  {id:'PRJ-008',name:'Kenya Agroforestry Belt',          type:'Agroforestry',  location:'Rift Valley, Kenya',    credits:5600,  area:1200,  price:27.00, ngo:'EcoGuard Brazil',   verified:89},
];

// Mock ESG Report Data
export const mockESGReport = {
  meta: {
    company: 'Microsoft Sustainability',
    scope: 'Full Portfolio',
    reporting_year: 2024,
    generated_timestamp: new Date().toISOString(),
    report_period: 'Jan 1, 2024 - Dec 31, 2024',
  },
  environmental: {
    carbon_offset_total: 49400,
    carbon_offset_unit: 'tonnes CO₂e',
    carbon_offset_value_usd: 1_405_150,
    ndvi_avg: 0.62,
    ndvi_trend: [
      {month:'Jan',value:0.48},{month:'Feb',value:0.51},{month:'Mar',value:0.54},
      {month:'Apr',value:0.58},{month:'May',value:0.62},{month:'Jun',value:0.65},
      {month:'Jul',value:0.63},{month:'Aug',value:0.61},{month:'Sep',value:0.60},
      {month:'Oct',value:0.58},{month:'Nov',value:0.54},{month:'Dec',value:0.52},
    ],
    lst_avg_celsius: 24.3,
    lst_trend: [
      {month:'Jan',value:22.1},{month:'Feb',value:22.8},{month:'Mar',value:23.5},
      {month:'Apr',value:24.2},{month:'May',value:25.1},{month:'Jun',value:26.3},
      {month:'Jul',value:27.2},{month:'Aug',value:26.8},{month:'Sep',value:25.4},
      {month:'Oct',value:24.1},{month:'Nov',value:22.9},{month:'Dec',value:21.8},
    ],
    biodiversity_score: 0.78,
    water_conservation_ml: 15_600_000,
  },
  social: {
    communities_supported: 24,
    jobs_created: 1850,
    jobs_permanent: 1240,
    jobs_seasonal: 610,
    local_employment_rate: 0.88,
    training_hours: 12400,
    csr_initiatives: 18,
    csr_beneficiaries: 45000,
  },
  governance: {
    compliance_score: 0.94,
    audit_status: 'Verified',
    risk_score: 0.12,
    risk_level: 'Low',
    certifications: ['ISO 14001', 'GRI Standard', 'ISSB IFRS S2 Ready', 'TCFD Aligned'],
  },
  carbon_by_project: [
    {name:'Amazon Reforestation',value:12400,project_id:'PRJ-001'},
    {name:'Congo Basin Forest Shield',value:22000,project_id:'PRJ-003'},
    {name:'Vietnamese Mangrove',value:6800,project_id:'PRJ-005'},
    {name:'Methane Capture Bihar',value:9400,project_id:'PRJ-006'},
  ],
  esg_scores: {
    environmental: 87,
    social: 82,
    governance: 94,
  },
  methodology: {
    verification_method: 'Satellite analysis (NDVI & LST proxies)',
    engine: 'MRV-engine derived estimates',
    standards: ['GRI 305-1', 'ISSB IFRS S2', 'TCFD Framework'],
    confidence_level: 0.92,
  },
};

// Mock single-project ESG report
export const generateMockESGReport = (projectId = null) => {
  if (!projectId) {
    return { data: mockESGReport, error: null };
  }
  const project = mockProjects.find(p => p.id === projectId);
  if (!project) {
    return { data: null, error: 'Project not found' };
  }
  const carbonForProject = project.credits || 0;
  return {
    data: {
      ...mockESGReport,
      meta: { ...mockESGReport.meta, scope: `Single Project: ${project.name}` },
      environmental: {
        ...mockESGReport.environmental,
        carbon_offset_total: carbonForProject,
        carbon_offset_value_usd: carbonForProject * 28.5,
        biodiversity_score: 0.78 + Math.random() * 0.15,
      },
      social: {
        ...mockESGReport.social,
        communities_supported: Math.ceil(24 * (carbonForProject / 49400)),
        jobs_created: Math.ceil(1850 * (carbonForProject / 49400)),
      },
      carbon_by_project: [{name: project.name, value: carbonForProject, project_id: projectId}],
    },
    error: null,
  };
};
