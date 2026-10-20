-- ==============================================================================
-- MY SAFE CITY - REAL-WORLD DEMO SEED DATA (DEHRADUN, UTTARAKHAND)
-- Realistic incidents, emergency stations, SOS dispatches, and user accounts.
-- Safe to execute in Supabase SQL Editor.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DEMO USER ACCOUNTS & PROFILES (DEHRADUN)
-- Passwords:
--   Admin:   admin@safecity.in       / AdminPassword@123
--   Citizen: priya.rawat@example.com / CitizenPassword@123
--   Citizen: amit.negi@example.com   / CitizenPassword@123
-- ------------------------------------------------------------------------------

-- Insert into auth.users (if not already present)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@safecity.in',
    crypt('AdminPassword@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Chief Insp. Rakesh Sharma","phone":"+91 9897000100"}'::jsonb,
    now() - interval '60 days',
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'priya.rawat@example.com',
    crypt('CitizenPassword@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Priya Rawat","phone":"+91 9412000201"}'::jsonb,
    now() - interval '45 days',
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'amit.negi@example.com',
    crypt('CitizenPassword@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Amit Negi","phone":"+91 9412000202"}'::jsonb,
    now() - interval '30 days',
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'sunita.joshi@example.com',
    crypt('CitizenPassword@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Sunita Joshi","phone":"+91 9412000203"}'::jsonb,
    now() - interval '20 days',
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'rohit.verma@example.com',
    crypt('CitizenPassword@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Rohit Verma","phone":"+91 9412000204"}'::jsonb,
    now() - interval '15 days',
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'fake.reporter@example.com',
    crypt('CitizenPassword@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Suspicious User Demo","phone":"+91 9412000205"}'::jsonb,
    now() - interval '10 days',
    now(),
    'authenticated',
    'authenticated'
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password;

-- Ensure profiles are populated
INSERT INTO public.profiles (id, name, email, phone, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Chief Insp. Rakesh Sharma', 'admin@safecity.in', '+91 9897000100', now() - interval '60 days', now()),
  ('c0000000-0000-0000-0000-000000000001', 'Priya Rawat', 'priya.rawat@example.com', '+91 9412000201', now() - interval '45 days', now()),
  ('c0000000-0000-0000-0000-000000000002', 'Amit Negi', 'amit.negi@example.com', '+91 9412000202', now() - interval '30 days', now()),
  ('c0000000-0000-0000-0000-000000000003', 'Sunita Joshi', 'sunita.joshi@example.com', '+91 9412000203', now() - interval '20 days', now()),
  ('c0000000-0000-0000-0000-000000000004', 'Rohit Verma', 'rohit.verma@example.com', '+91 9412000204', now() - interval '15 days', now()),
  ('c0000000-0000-0000-0000-000000000005', 'Suspicious User Demo', 'fake.reporter@example.com', '+91 9412000205', now() - interval '10 days', now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone;

-- Ensure user roles are mapped
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin'),
  ('c0000000-0000-0000-0000-000000000001', 'citizen'),
  ('c0000000-0000-0000-0000-000000000002', 'citizen'),
  ('c0000000-0000-0000-0000-000000000003', 'citizen'),
  ('c0000000-0000-0000-0000-000000000004', 'citizen'),
  ('c0000000-0000-0000-0000-000000000005', 'citizen')
ON CONFLICT (user_id, role) DO NOTHING;

-- Ensure admin has admin role set specifically
DELETE FROM public.user_roles WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND role = 'citizen';

-- Citizen access controls (illustrating active, temporarily blocked, and blacklisted)
INSERT INTO public.citizen_access_controls (user_id, status, blocked_until, updated_by, updated_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'active', NULL, 'a0000000-0000-0000-0000-000000000001', now()),
  ('c0000000-0000-0000-0000-000000000002', 'active', NULL, 'a0000000-0000-0000-0000-000000000001', now()),
  ('c0000000-0000-0000-0000-000000000003', 'active', NULL, 'a0000000-0000-0000-0000-000000000001', now()),
  ('c0000000-0000-0000-0000-000000000004', 'temporarily_blocked', now() + interval '24 hours', 'a0000000-0000-0000-0000-000000000001', now()),
  ('c0000000-0000-0000-0000-000000000005', 'blacklisted', NULL, 'a0000000-0000-0000-0000-000000000001', now())
ON CONFLICT (user_id) DO UPDATE SET
  status = EXCLUDED.status,
  blocked_until = EXCLUDED.blocked_until,
  updated_at = EXCLUDED.updated_at;

-- ------------------------------------------------------------------------------
-- 2. REAL DEHRADUN EMERGENCY SERVICES (POLICE, HOSPITALS, FIRE STATIONS)
-- ------------------------------------------------------------------------------

DELETE FROM public.emergency_services WHERE name IN (
  'Kotwali Dehradun',
  'Dalanwala Police Station',
  'Cantt Police Station',
  'Rajpur Police Station',
  'Patel Nagar Police Station',
  'Raipur Police Station',
  'Doon Government Medical College & Hospital',
  'Max Super Speciality Hospital',
  'Synergy Community Hospital',
  'Shri Mahant Indiresh Hospital',
  'Fire Station Dehradun City',
  'Fire Station Raipur'
);

INSERT INTO public.emergency_services (id, name, type, location_lat, location_lng, address, phone)
VALUES
  -- Police Stations
  ('e0000000-0000-0000-0000-000000000001', 'Kotwali Dehradun', 'police', 30.3235, 78.0405, 'Near Clock Tower, Paltan Bazaar, Dehradun 248001', '0135-2623333'),
  ('e0000000-0000-0000-0000-000000000002', 'Dalanwala Police Station', 'police', 30.3275, 78.0570, 'Circular Road, Dalanwala, Dehradun 248001', '0135-2657233'),
  ('e0000000-0000-0000-0000-000000000003', 'Cantt Police Station', 'police', 30.3390, 78.0120, 'Chakrata Road, Dehradun Cantt 248003', '0135-2751333'),
  ('e0000000-0000-0000-0000-000000000004', 'Rajpur Police Station', 'police', 30.3850, 78.0920, 'Old Rajpur Road, Dehradun 248009', '0135-2734333'),
  ('e0000000-0000-0000-0000-000000000005', 'Patel Nagar Police Station', 'police', 30.3050, 78.0190, 'Saharanpur Chowk, Patel Nagar, Dehradun 248001', '0135-2720333'),
  ('e0000000-0000-0000-0000-000000000006', 'Raipur Police Station', 'police', 30.3090, 78.0880, 'Raipur Main Road, Dehradun 248008', '0135-2787333'),

  -- Hospitals
  ('e0000000-0000-0000-0000-000000000007', 'Doon Government Medical College & Hospital', 'hospital', 30.3220, 78.0435, 'Court Road, Prince Chowk, Dehradun 248001', '0135-2718400'),
  ('e0000000-0000-0000-0000-000000000008', 'Max Super Speciality Hospital', 'hospital', 30.3840, 78.0810, 'Mussoorie Diversion Road, Malsi, Dehradun 248001', '0135-7193000'),
  ('e0000000-0000-0000-0000-000000000009', 'Synergy Community Hospital', 'hospital', 30.3395, 78.0080, 'Ballupur Canal Road, Dehradun 248001', '0135-2226000'),
  ('e0000000-0000-0000-0000-000000000010', 'Shri Mahant Indiresh Hospital', 'hospital', 30.3080, 78.0210, 'Patel Nagar, Dehradun 248001', '0135-6672400'),

  -- Fire Stations
  ('e0000000-0000-0000-0000-000000000011', 'Fire Station Dehradun City', 'fire', 30.3170, 78.0380, 'Gandhi Road, Near Prince Chowk, Dehradun 248001', '0135-2650101'),
  ('e0000000-0000-0000-0000-000000000012', 'Fire Station Raipur', 'fire', 30.3110, 78.0850, 'Industrial Area, Raipur, Dehradun 248008', '0135-2787101');

-- ------------------------------------------------------------------------------
-- 3. REAL-WORLD CRIME & SAFETY INCIDENTS IN DEHRADUN
-- ------------------------------------------------------------------------------

DELETE FROM public.crime_reports WHERE id IN (
  'f0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000004',
  'f0000000-0000-0000-0000-000000000005',
  'f0000000-0000-0000-0000-000000000006',
  'f0000000-0000-0000-0000-000000000007',
  'f0000000-0000-0000-0000-000000000008',
  'f0000000-0000-0000-0000-000000000009',
  'f0000000-0000-0000-0000-000000000010'
);

INSERT INTO public.crime_reports (
  id,
  user_id,
  type,
  title,
  description,
  location_lat,
  location_lng,
  location_address,
  crime_location_lat,
  crime_location_lng,
  crime_location_address,
  crime_time,
  status,
  severity,
  assigned_station,
  estimated_resolution_time,
  admin_action,
  authenticity_score,
  authenticity_analysis,
  resolved_at,
  created_at
)
VALUES
  -- 1. Theft at Clock Tower / Paltan Bazaar
  (
    'f0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'theft',
    'Pickpocketing & Mobile Theft near Paltan Bazaar Gate',
    'Wallet containing Rs 4,500 and an iPhone 13 were snatched near the central entrance of Paltan Bazaar during peak evening hours. Two youths on a black Pulsar motorcycle fled toward Prince Chowk.',
    30.3238,
    78.0410,
    'Paltan Bazaar Road, Clock Tower, Dehradun',
    30.3238,
    78.0410,
    'Central Gate, Paltan Bazaar, Dehradun',
    now() - interval '2 days',
    'approved',
    'medium',
    'Kotwali Dehradun',
    '4 days',
    '{"action":"FIR #184/2026 registered. CCTV footage requested from market association cameras.","note":"Patrols increased at Paltan Bazaar entry."}'::jsonb,
    88,
    '{"reasoning":"Specific location details, realistic timeline, matches recurring bazaar theft patterns, verified merchant CCTV coverage.","confidence":"high"}'::jsonb,
    NULL,
    now() - interval '2 days'
  ),

  -- 2. High-Severity Hit & Run on Rajpur Road near Jakhan / Pacific Mall
  (
    'f0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'other',
    'Hit-and-Run Collision on Rajpur Road near Pacific Mall',
    'A speeding white SUV broke the red light at Jakhan intersection, struck a delivery rider on a scooter, and sped off towards Mussoorie Diversion. The injured victim was taken to Max Hospital by nearby taxi drivers.',
    30.3645,
    78.0705,
    'Rajpur Road, Jakhan, Dehradun',
    30.3645,
    78.0705,
    'Jakhan Traffic Junction, Rajpur Road',
    now() - interval '1 day',
    'investigating',
    'high',
    'Rajpur Police Station',
    '2 days',
    '{"action":"PCR vehicle dispatched to Max Hospital. Highway CCTV cameras at Mussoorie Toll alerted.","note":"Registration number partially identified as UK-07-XX."}'::jsonb,
    95,
    '{"reasoning":"High credibility corroborated by traffic junction CCTV logs and hospital admission records.","confidence":"very_high"}'::jsonb,
    NULL,
    now() - interval '1 day'
  ),

  -- 3. ATM Skimming Fraud in Prem Nagar Market
  (
    'f0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000003',
    'fraud',
    'ATM Card Skimming Device at Chakrata Road Booth',
    'Unauthorized transaction of Rs 40,000 made within 15 minutes of withdrawing cash from the standalone ATM booth near Prem Nagar Chowk. A loose false card reader attachment was noticed on the machine.',
    30.3335,
    77.9615,
    'Chakrata Road, Prem Nagar, Dehradun',
    30.3335,
    77.9615,
    'Opposite Prem Nagar Post Office',
    now() - interval '4 days',
    'investigating',
    'medium',
    'Cantt Police Station',
    '5 days',
    '{"action":"Cyber Crime Unit notified. ATM booth temporarily sealed for biometric and device retrieval.","note":"Bank surveillance video under forensic audit."}'::jsonb,
    84,
    '{"reasoning":"Consistent with recent regional cyber cell skimming warnings on standalone ATM kiosks.","confidence":"high"}'::jsonb,
    NULL,
    now() - interval '4 days'
  ),

  -- 4. Street Harassment near Clement Town Graphic Era Area (Resolved)
  (
    'f0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000001',
    'harassment',
    'Vehicle-Borne Street Harassment near Clement Town Campus',
    'Three individuals in an unregistered silver hatchback repeatedly stalked and passed vulgar remarks at female students walking from the university campus towards Subhash Nagar bus stop.',
    30.2675,
    78.0120,
    'Subhash Nagar Road, Clement Town, Dehradun',
    30.2675,
    78.0120,
    'University Gate 2 Road, Clement Town',
    now() - interval '6 days',
    'resolved',
    'medium',
    'Patel Nagar Police Station',
    'Resolved',
    '{"action":"Cheetah mobile patrol intercepted the vehicle near Bell Road. Formal challan and summons issued under Police Act.","note":"Perpetrators identified and reprimanded with college administration present."}'::jsonb,
    91,
    '{"reasoning":"Direct student witnesses and quick police intervention confirmed the sequence of events.","confidence":"high"}'::jsonb,
    now() - interval '4 days',
    now() - interval '6 days'
  ),

  -- 5. Daytime House Burglary in Vasant Vihar Enclave
  (
    'f0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000002',
    'robbery',
    'Daytime Residential Break-in at Vasant Vihar Phase 2',
    'Rear balcony grill cut and bedroom safe broken open while homeowners were away between 2 PM and 5:30 PM. Gold jewelry, wristwatches, and emergency cash reported missing.',
    30.3265,
    78.0015,
    'Vasant Vihar Phase 2, Dehradun',
    30.3265,
    78.0015,
    'House 44/B, Vasant Vihar Phase 2',
    now() - interval '5 days',
    'approved',
    'high',
    'Cantt Police Station',
    '7 days',
    '{"action":"Dog squad and forensic fingerprint team took impressions. Community gate security logs seized.","note":"Neighbors CCTV captured two men in courier uniforms."}'::jsonb,
    96,
    '{"reasoning":"Verified on-site by sub-inspector; physical forensic evidence and neighborhood CCTV footage validate report.","confidence":"very_high"}'::jsonb,
    NULL,
    now() - interval '5 days'
  ),

  -- 6. Infrastructure Vandalism on Sahastradhara Road (Resolved)
  (
    'f0000000-0000-0000-0000-000000000006',
    'c0000000-0000-0000-0000-000000000003',
    'vandalism',
    'Deliberate Damage to Street Lights & Safety Barriers near IT Park',
    'Underground power cables intentionally sliced and three highway street lamps smashed, rendering a sharp blind turn pitch dark and prone to fatal nighttime accidents.',
    30.3540,
    78.0845,
    'Sahastradhara Road near IT Park, Dehradun',
    30.3540,
    78.0845,
    'Near Software Technology Park, Sahastradhara Road',
    now() - interval '8 days',
    'resolved',
    'low',
    'Dalanwala Police Station',
    'Resolved',
    '{"action":"Nagar Nigam engineering division dispatched. All 3 poles repaired with armored cabling.","note":"Night highway patrol unit assigned static monitoring."}'::jsonb,
    80,
    '{"reasoning":"Infrastructure damage physically inspected and confirmed by municipal electrical team.","confidence":"high"}'::jsonb,
    now() - interval '5 days',
    now() - interval '8 days'
  ),

  -- 7. Bicycle Theft at Dehradun Railway Station (Pending Citizen Report)
  (
    'f0000000-0000-0000-0000-000000000007',
    'c0000000-0000-0000-0000-000000000003',
    'theft',
    'Locked Geared Bicycle Stolen from Railway Station Parking',
    'High-end Firefox mountain bicycle was locked to the designated cycling stand near the north booking counter. Lock was cleanly cut with a bolt cutter between 11 AM and 3 PM.',
    30.3148,
    78.0345,
    'Station Road, Dehradun Railway Station',
    30.3148,
    78.0345,
    'Platform 1 North Parking, Railway Station',
    now() - interval '8 hours',
    'pending',
    'low',
    NULL,
    NULL,
    '{}'::jsonb,
    74,
    '{"reasoning":"Plausible theft report, awaiting railway station parking attendant statement and token stub check.","confidence":"medium"}'::jsonb,
    NULL,
    now() - interval '8 hours'
  ),

  -- 8. Group Clash & Assault near Karanpur DAV College Chowk
  (
    'f0000000-0000-0000-0000-000000000008',
    'c0000000-0000-0000-0000-000000000002',
    'assault',
    'Violent Student Group Altercation outside Karanpur Cafe',
    'An intense argument escalated into physical assault involving iron rods and wooden batons outside a snack point in Karanpur. One victim sustained stitches and was shifted to Doon Hospital.',
    30.3285,
    78.0525,
    'DAV College Road, Karanpur, Dehradun',
    30.3285,
    78.0525,
    'Near Survey Chowk intersection, Karanpur',
    now() - interval '18 hours',
    'approved',
    'high',
    'Dalanwala Police Station',
    '2 days',
    '{"action":"Cross-FIR filed under section 323, 324 IPC. 2 main instigators detained for interrogation.","note":"Area peace committee convened by local SHO."}'::jsonb,
    93,
    '{"reasoning":"Multiple independent phone calls received by 112; police unit was physically on scene.","confidence":"very_high"}'::jsonb,
    NULL,
    now() - interval '18 hours'
  ),

  -- 9. False Insurance Robbery Report (Rejected by Admin)
  (
    'f0000000-0000-0000-0000-000000000009',
    'c0000000-0000-0000-0000-000000000005',
    'robbery',
    'Fabricated Armed Bag Snatched Claim at Rispana Bridge',
    'Citizen claimed two gunmen robbed a briefcase containing Rs 5,00,000 cash in broad daylight at 11 AM in the middle of heavily congested Rispana Bridge crossing.',
    30.3010,
    78.0555,
    'Haridwar Bypass Road, Rispana Pull, Dehradun',
    30.3010,
    78.0555,
    'Rispana Bridge Main Flyover',
    now() - interval '9 days',
    'rejected',
    'high',
    'Patel Nagar Police Station',
    'Case Closed',
    '{"action":"Report rejected after comprehensive smart city traffic camera verification showed reporter arrived alone on bus without briefcase.","note":"Account blacklisted for submitting fraudulent police reports."}'::jsonb,
    14,
    '{"reasoning":"Complete absence of corroborating physical or video evidence; smart city camera timestamps explicitly contradict complainant story.","confidence":"very_high"}'::jsonb,
    NULL,
    now() - interval '9 days'
  ),

  -- 10. Chain Snatching near Ballupur Canal Road
  (
    'f0000000-0000-0000-0000-000000000010',
    'c0000000-0000-0000-0000-000000000001',
    'robbery',
    'Morning Chain Snatching on Ballupur Canal Walking Track',
    'An elderly woman out for a morning walk had her gold necklace forcibly yanked by two men riding an unnumbered motorcycle who fled towards GMS Road.',
    30.3380,
    78.0135,
    'Ballupur Canal Road, Dehradun',
    30.3380,
    78.0135,
    'Walkers Track, Near Synergy Hospital Crossing',
    now() - interval '3 days',
    'investigating',
    'high',
    'Cantt Police Station',
    '3 days',
    '{"action":"Checkpoints set up along GMS Road and Kaulagarh. Nearby commercial CCTV cameras collected.","note":"Modus operandi matches known interstate snatching gang."}'::jsonb,
    92,
    '{"reasoning":"Victim sustained neck abrasions treated at Synergy Hospital; physical trauma confirms snatching.","confidence":"high"}'::jsonb,
    NULL,
    now() - interval '3 days'
  );

-- ------------------------------------------------------------------------------
-- 4. REALISTIC SOS DISPATCH ALERTS (DEHRADUN)
-- ------------------------------------------------------------------------------

DELETE FROM public.sos_alerts WHERE id IN (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003'
);

INSERT INTO public.sos_alerts (
  id,
  user_id,
  location_lat,
  location_lng,
  location_address,
  status,
  delivered_at,
  acknowledged_at,
  responder_name,
  eta_minutes,
  resolved_at,
  created_at
)
VALUES
  -- 1. Active Responding SOS near Clock Tower
  (
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    30.3242,
    78.0415,
    'Near Clock Tower, Rajpur Road entry, Dehradun',
    'responding',
    now() - interval '12 minutes',
    now() - interval '9 minutes',
    'Cheetah Patrol 04 - SI Naveen Bisht',
    3,
    NULL,
    now() - interval '12 minutes'
  ),

  -- 2. Fresh Active SOS near ISBT Dehradun
  (
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    30.2880,
    78.0075,
    'Near ISBT Bus Terminal Main Exit, Haridwar Bypass, Dehradun',
    'active',
    now() - interval '3 minutes',
    NULL,
    NULL,
    NULL,
    NULL,
    now() - interval '3 minutes'
  ),

  -- 3. Resolved SOS from Yesterday near Pacific Mall
  (
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000003',
    30.3655,
    78.0710,
    'Rajpur Road, Near Pacific Mall Front Arcade, Dehradun',
    'resolved',
    now() - interval '1 day',
    now() - interval '1 day' + interval '2 minutes',
    'PCR Van 07 - HC Mahendra Singh',
    2,
    now() - interval '1 day' + interval '25 minutes',
    now() - interval '1 day'
  );

-- ------------------------------------------------------------------------------
-- 5. CITY-WIDE SAFETY NOTIFICATIONS (DEHRADUN)
-- ------------------------------------------------------------------------------

DELETE FROM public.notifications WHERE title IN (
  'Night Patrolling Intensified along Rajpur Road',
  'Traffic Advisory: Ballupur Canal Road Diversion',
  'Cyber Safety Alert: Standalone ATM Skimming Advisory',
  'Free Emergency Trauma & CPR Training Camp'
);

INSERT INTO public.notifications (user_id, type, title, message, read, created_at)
VALUES
  (
    NULL,
    'alert',
    'Night Patrolling Intensified along Rajpur Road',
    'Dehradun Police has deployed dedicated Cheetah mobile response units between Clock Tower, Jakhan, and Malsi Diversion from 10 PM to 4 AM for student and citizen safety.',
    false,
    now() - interval '1 day'
  ),
  (
    NULL,
    'system',
    'Traffic Advisory: Ballupur Canal Road Diversion',
    'Culvert repair work is ongoing along Ballupur Canal Road near Synergy Hospital. Citizens traveling towards Chakrata Road are advised to use GMS Road or Kaulagarh route.',
    false,
    now() - interval '2 days'
  ),
  (
    NULL,
    'alert',
    'Cyber Safety Alert: Standalone ATM Skimming Advisory',
    'Be vigilant when using standalone ATM booths in Prem Nagar and Clement Town areas. Ensure the card reader is firmly attached and covers PIN entry. Report anomalies to National Cyber Crime helpline 1930.',
    true,
    now() - interval '4 days'
  ),
  (
    NULL,
    'info',
    'Free Emergency Trauma & CPR Training Camp',
    'Doon Government Medical College in association with State Disaster Response Force (SDRF) is hosting a free citizen first-responder CPR workshop this Saturday at 11 AM.',
    true,
    now() - interval '7 days'
  );

-- ------------------------------------------------------------------------------
-- 6. SAMPLE AI ASSISTANT CHAT INTERACTIONS
-- ------------------------------------------------------------------------------

DELETE FROM public.chat_messages WHERE user_id = 'c0000000-0000-0000-0000-000000000001';

INSERT INTO public.chat_messages (user_id, message, response, location_lat, location_lng, created_at)
VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'I am near Clock Tower and my purse was just stolen. What should I do right now?',
    'Stay calm. First, head towards Kotwali Dehradun Police Station located right next to Paltan Bazaar entrance (approx. 150 meters from Clock Tower). If you have an urgent safety threat, press the SOS button in this app or dial 112 directly. If your bank cards were in your purse, call your bank customer care immediately to block them.',
    30.3240,
    78.0418,
    now() - interval '2 days'
  ),
  (
    'c0000000-0000-0000-0000-000000000001',
    'Which is the nearest emergency hospital from Rajpur Road?',
    'If you are on Rajpur Road near Jakhan/Malsi, Max Super Speciality Hospital is nearest (Phone: 0135-7193000). If you are closer to Clock Tower / Prince Chowk, Doon Government Medical College Hospital on Court Road has a 24x7 trauma center (Phone: 0135-2718400). Both have been pinned to your Emergency Services map.',
    30.3640,
    78.0700,
    now() - interval '1 day'
  );
