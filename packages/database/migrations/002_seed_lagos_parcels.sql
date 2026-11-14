SET search_path TO anagu, public;

INSERT INTO anagu.land_parcels (parcel_number, geometry, area_sqm, state, lga, address, status) VALUES
('LG-VI-001', ST_GeomFromText('POLYGON((3.4201 6.4290, 3.4215 6.4290, 3.4215 6.4280, 3.4201 6.4280, 3.4201 6.4290))', 4326), 1680.50, 'Lagos', 'Eti-Osa', '15 Akin Adesola Street, Victoria Island', 'active'),
('LG-VI-002', ST_GeomFromText('POLYGON((3.4230 6.4295, 3.4244 6.4295, 3.4244 6.4285, 3.4230 6.4285, 3.4230 6.4295))', 4326), 1620.30, 'Lagos', 'Eti-Osa', '22 Ozumba Mbadiwe Avenue, Victoria Island', 'active'),
('LG-LK-001', ST_GeomFromText('POLYGON((3.4710 6.4350, 3.4724 6.4350, 3.4724 6.4340, 3.4710 6.4340, 3.4710 6.4350))', 4326), 1710.20, 'Lagos', 'Eti-Osa', '10 Admiralty Way, Lekki Phase 1', 'active'),
('LG-LK-002', ST_GeomFromText('POLYGON((3.4740 6.4360, 3.4754 6.4360, 3.4754 6.4350, 3.4740 6.4350, 3.4740 6.4360))', 4326), 1680.80, 'Lagos', 'Eti-Osa', '45 Fola Osibo Road, Lekki Phase 1', 'active'),
('LG-IK-001', ST_GeomFromText('POLYGON((3.3410 6.5920, 3.3424 6.5920, 3.3424 6.5910, 3.3410 6.5910, 3.3410 6.5920))', 4326), 1620.60, 'Lagos', 'Ikeja', '5 Obafemi Awolowo Way, Ikeja', 'active'),
('LG-IK-002', ST_GeomFromText('POLYGON((3.3440 6.5930, 3.3454 6.5930, 3.3454 6.5920, 3.3440 6.5920, 3.3440 6.5930))', 4326), 1590.40, 'Lagos', 'Ikeja', '12 Allen Avenue, Ikeja', 'pending'),
('LG-SU-001', ST_GeomFromText('POLYGON((3.3620 6.4980, 3.3634 6.4980, 3.3634 6.4970, 3.3620 6.4970, 3.3620 6.4980))', 4326), 1600.90, 'Lagos', 'Surulere', '8 Bode Thomas Street, Surulere', 'active'),
('LG-SU-002', ST_GeomFromText('POLYGON((3.3650 6.4990, 3.3664 6.4990, 3.3664 6.4980, 3.3650 6.4980, 3.3650 6.4990))', 4326), 1570.20, 'Lagos', 'Surulere', '30 Adeniran Ogunsanya Street, Surulere', 'pending'),
('LG-YB-001', ST_GeomFromText('POLYGON((3.3760 6.5100, 3.3774 6.5100, 3.3774 6.5090, 3.3760 6.5090, 3.3760 6.5100))', 4326), 1610.50, 'Lagos', 'Mainland', '22 Herbert Macaulay Way, Yaba', 'active'),
('LG-YB-002', ST_GeomFromText('POLYGON((3.3790 6.5110, 3.3804 6.5110, 3.3804 6.5100, 3.3790 6.5100, 3.3790 6.5110))', 4326), 1580.70, 'Lagos', 'Mainland', '7 Commercial Avenue, Yaba', 'active')
ON CONFLICT (parcel_number) DO NOTHING;
