// HERO Card checklist definition — shared by the server (validation, stats)
// and the client (form rendering). Mirrors the paper card 1:1.

export const RATINGS = ['S', 'I', 'C'];

export const CHECKLIST = [
  {
    key: 'slips',
    en: 'Slips, Trips & Fall Protection',
    es: 'Resbalones, tropiezos y protección contra caídas',
    icon: 'stairs',
    items: [
      { key: 'stairs_walkways', en: 'Stairs and Walkways', es: 'Escaleras y pasillos' },
      { key: 'toeboards', en: 'Toeboards', es: 'Rodapiés' },
      { key: 'deck', en: 'Deck', es: 'Plataforma / cubierta' },
      { key: 'ladders', en: 'Ladders', es: 'Escaleras de mano' },
      { key: 'housekeeping', en: 'Housekeeping', es: 'Orden y limpieza' },
    ],
  },
  {
    key: 'ppe',
    en: 'Personal Protective Equipment',
    es: 'Equipo de protección personal',
    icon: 'hardhat',
    items: [
      { key: 'required_ppe', en: 'Required PPE', es: 'EPP requerido' },
      { key: 'fall_protection_equipment', en: 'Fall Protection Equipment', es: 'Equipo contra caídas' },
      { key: 'respiratory_equipment', en: 'Respiratory Equipment', es: 'Equipo respiratorio' },
      { key: 'ppe_inspected', en: 'PPE Inspected', es: 'EPP inspeccionado' },
      { key: 'ppe_condition', en: 'PPE is good/proper condition', es: 'EPP en buen estado' },
    ],
  },
  {
    key: 'material',
    en: 'Material Handling',
    es: 'Manejo de materiales',
    icon: 'box',
    items: [
      { key: 'proper_lifting', en: 'Proper Lifting', es: 'Levantamiento correcto' },
      { key: 'moving_materials', en: 'Moving Materials', es: 'Movimiento de materiales' },
      { key: 'mechanical_operating', en: 'Mechanical Operating', es: 'Operación mecánica' },
      { key: 'line_of_fire', en: 'Line of Fire', es: 'Línea de fuego' },
      { key: 'loading_unloading', en: 'Loading/Unloading', es: 'Carga / descarga' },
      { key: 'chemical_handling', en: 'Chemical Handling', es: 'Manejo de químicos' },
      { key: 'pinch_points', en: 'Pinch Points', es: 'Puntos de atrapamiento' },
      { key: 'body_positions', en: 'Body Positions', es: 'Posiciones del cuerpo' },
      { key: 'vehicle_operation', en: 'Vehicle Operation', es: 'Operación de vehículos' },
      { key: 'dropped_object_prevention', en: 'Dropped Object Prevention', es: 'Prevención de caída de objetos' },
    ],
  },
  {
    key: 'tools',
    en: 'Tool and Equipment Use',
    es: 'Uso de herramientas y equipos',
    icon: 'wrench',
    items: [
      { key: 'required_tools', en: 'Required Tools', es: 'Herramientas requeridas' },
      { key: 'hoses_couplings', en: 'Hoses/Couplings/Whip Check', es: 'Mangueras / acoples / whip check' },
      { key: 'sensitive_equipment', en: 'Sensitive Equipment', es: 'Equipo sensible' },
      { key: 'mobile_heavy_equipment', en: 'Mobile/Heavy Equipment', es: 'Equipo móvil / pesado' },
      { key: 'hand_portable', en: 'Hand and Portable', es: 'Manuales y portátiles' },
      { key: 'fire_extinguisher', en: 'Fire Extinguisher', es: 'Extintor' },
    ],
  },
  {
    key: 'rules',
    en: 'Rules and Regulations',
    es: 'Reglas y regulaciones',
    icon: 'clipboard',
    items: [
      { key: 'jha', en: 'Job Hazard Analysis', es: 'Análisis de riesgos (JHA)' },
      { key: 'safe_work_permit', en: 'Safe Work Permit', es: 'Permiso de trabajo seguro' },
      { key: 'lockout_tagout', en: 'Lockout/Tagout', es: 'Bloqueo / etiquetado (LOTO)' },
      { key: 'inspection_forms', en: 'Inspection Forms', es: 'Formatos de inspección' },
      { key: 'confined_space', en: 'Confined Space', es: 'Espacio confinado' },
      { key: 'job_procedures', en: 'Job Procedures', es: 'Procedimientos de trabajo' },
      { key: 'sse_mentor', en: 'SSE Mentor Program', es: 'Programa mentor SSE' },
      { key: 'electrical', en: 'Electrical', es: 'Eléctrico' },
      { key: 'cutting_welding', en: 'Cutting and Welding', es: 'Corte y soldadura' },
      { key: 'excavation_shoring', en: 'Excavation and Shoring', es: 'Excavación y apuntalamiento' },
      { key: 'other', en: 'Other', es: 'Otro' },
    ],
  },
];

export const ALL_ITEMS = CHECKLIST.flatMap((c) =>
  c.items.map((i) => ({ ...i, category: c.key }))
);

export const ITEM_KEYS = new Set(ALL_ITEMS.map((i) => i.key));
