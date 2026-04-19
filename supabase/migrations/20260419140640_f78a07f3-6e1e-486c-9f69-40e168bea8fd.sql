UPDATE public.messages SET document_size = CASE id
  WHEN 'fc6d20ca-bf84-40a8-a838-b54ef193bccb'::uuid THEN 154938
  WHEN 'a5642b8e-3727-4fca-86af-5aa72be58601'::uuid THEN 92492
  WHEN 'd2c512ad-1e10-4be9-a23a-50a7af1756c7'::uuid THEN 29507
  WHEN '42ff5b56-265d-49c5-884b-2eecaafdba8f'::uuid THEN 122741
  WHEN 'c3453a1d-4966-4681-9533-1a56b30551cb'::uuid THEN 71554
  WHEN '8f67b837-3b1c-44a8-91b1-da2e1c35bdfb'::uuid THEN 1900764
  WHEN 'a2cc7b0b-ee98-4bb1-96ab-8fbe61fa6368'::uuid THEN 799912
  WHEN '87093f97-9787-43a0-8df1-64b9ba9bac37'::uuid THEN 1752007
  WHEN 'bcd7a44b-a6fe-4e83-8af5-23984480a654'::uuid THEN 582122
  WHEN 'a5a22954-5902-49ba-a3c8-e2efbc9865cb'::uuid THEN 12318675
  WHEN '178b94e6-3eb6-4c68-b72e-f98ebb0cba9d'::uuid THEN 1546285
  WHEN '12253a8f-6af2-4651-b7b2-bed49eea1c78'::uuid THEN 3077
  WHEN '397a356c-73b7-4310-8b05-b21d98e0fdfb'::uuid THEN 1058972
  WHEN 'e2f0af5e-22c4-49b8-8b2d-015afe53778c'::uuid THEN 3077
END
WHERE id IN (
  'fc6d20ca-bf84-40a8-a838-b54ef193bccb','a5642b8e-3727-4fca-86af-5aa72be58601','d2c512ad-1e10-4be9-a23a-50a7af1756c7',
  '42ff5b56-265d-49c5-884b-2eecaafdba8f','c3453a1d-4966-4681-9533-1a56b30551cb','8f67b837-3b1c-44a8-91b1-da2e1c35bdfb',
  'a2cc7b0b-ee98-4bb1-96ab-8fbe61fa6368','87093f97-9787-43a0-8df1-64b9ba9bac37','bcd7a44b-a6fe-4e83-8af5-23984480a654',
  'a5a22954-5902-49ba-a3c8-e2efbc9865cb','178b94e6-3eb6-4c68-b72e-f98ebb0cba9d','12253a8f-6af2-4651-b7b2-bed49eea1c78',
  '397a356c-73b7-4310-8b05-b21d98e0fdfb','e2f0af5e-22c4-49b8-8b2d-015afe53778c'
);