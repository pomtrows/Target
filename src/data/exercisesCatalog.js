export const EXERCISE_CATEGORIES = {
  CORE: 'Gainage',
  ABS: 'Abdos',
  UPPER: 'Haut du corps',
  LOWER: 'Jambes',
  CARDIO: 'Cardio'
};

export const GOAL_TYPES = {
  TIME: 'time', // en secondes
  REPS: 'reps'  // en répétitions
};

export const LEVEL = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé'
};

export const exercisesCatalog = [
  // GAINAGE
  {
    id: 'ex_core_001',
    name: 'Planche faciale',
    category: EXERCISE_CATEGORIES.CORE,
    goalType: GOAL_TYPES.TIME,
    mediaUrl: '/images/sport/planche_faciale_1779033170718.png',
    level: LEVEL.BEGINNER
  },
  {
    id: 'ex_core_002',
    name: 'Planche latérale (Gauche)',
    category: EXERCISE_CATEGORIES.CORE,
    goalType: GOAL_TYPES.TIME,
    mediaUrl: '/images/sport/planche_laterale_gauche_1779033184819.png',
    level: LEVEL.INTERMEDIATE
  },
  {
    id: 'ex_core_003',
    name: 'Planche latérale (Droite)',
    category: EXERCISE_CATEGORIES.CORE,
    goalType: GOAL_TYPES.TIME,
    mediaUrl: '/images/sport/planche_laterale_droite_1779033200773.png',
    level: LEVEL.INTERMEDIATE
  },
  {
    id: 'ex_core_004',
    name: 'Hollow Body Hold',
    category: EXERCISE_CATEGORIES.CORE,
    goalType: GOAL_TYPES.TIME,
    mediaUrl: '/images/sport/hollow_body_hold_1779033213722.png',
    level: LEVEL.ADVANCED
  },
  {
    id: 'ex_core_005',
    name: 'Planche à l\'envers',
    category: EXERCISE_CATEGORIES.CORE,
    goalType: GOAL_TYPES.TIME,
    mediaUrl: '/images/sport/planche_envers_1779089420229.png',
    level: LEVEL.INTERMEDIATE
  },
  {
    id: 'ex_core_006',
    name: 'Planche avec torsion (Gauche)',
    category: EXERCISE_CATEGORIES.CORE,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/planche_torsion_gauche_1779090481943.png',
    level: LEVEL.INTERMEDIATE
  },
  {
    id: 'ex_core_007',
    name: 'Planche avec torsion (Droite)',
    category: EXERCISE_CATEGORIES.CORE,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/planche_torsion_droite_coherente_1779090626890.png',
    level: LEVEL.INTERMEDIATE
  },
  
  // ABDOS
  {
    id: 'ex_abs_001',
    name: 'Crunchs',
    category: EXERCISE_CATEGORIES.ABS,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/crunchs_1779033227294.png',
    level: LEVEL.BEGINNER
  },
  {
    id: 'ex_abs_002',
    name: 'Russian Twists',
    category: EXERCISE_CATEGORIES.ABS,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/russian_twists_1779033241143.png',
    level: LEVEL.INTERMEDIATE
  },
  {
    id: 'ex_abs_003',
    name: 'Leg Raises',
    category: EXERCISE_CATEGORIES.ABS,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/leg_raises_1779033256472.png',
    level: LEVEL.INTERMEDIATE
  },
  {
    id: 'ex_abs_004',
    name: 'V-Ups',
    category: EXERCISE_CATEGORIES.ABS,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/v_ups_1779033317790.png',
    level: LEVEL.ADVANCED
  },
  
  // HAUT DU CORPS
  {
    id: 'ex_upper_001',
    name: 'Pompes sur les genoux',
    category: EXERCISE_CATEGORIES.UPPER,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/pompes_genoux_1779033281532.png',
    level: LEVEL.BEGINNER
  },
  {
    id: 'ex_upper_002',
    name: 'Pompes classiques',
    category: EXERCISE_CATEGORIES.UPPER,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/pompes_classiques_1779033293047.png',
    level: LEVEL.INTERMEDIATE
  },
  {
    id: 'ex_upper_003',
    name: 'Pompes diamant',
    category: EXERCISE_CATEGORIES.UPPER,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/pompes_diamant_1779033329382.png',
    level: LEVEL.ADVANCED
  },
  {
    id: 'ex_upper_004',
    name: 'Dips sur chaise',
    category: EXERCISE_CATEGORIES.UPPER,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/dips_chaise_1779033342862.png',
    level: LEVEL.INTERMEDIATE
  },

  // JAMBES
  {
    id: 'ex_lower_001',
    name: 'Squats',
    category: EXERCISE_CATEGORIES.LOWER,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/squats_1779033356750.png',
    level: LEVEL.BEGINNER
  },
  {
    id: 'ex_lower_002',
    name: 'Fentes avant',
    category: EXERCISE_CATEGORIES.LOWER,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/fentes_avant_1779033369558.png',
    level: LEVEL.INTERMEDIATE
  },
  {
    id: 'ex_lower_003',
    name: 'Fentes sautées',
    category: EXERCISE_CATEGORIES.LOWER,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/fentes_sautees_1779033382726.png',
    level: LEVEL.ADVANCED
  },
  {
    id: 'ex_lower_004',
    name: 'Glute Bridges',
    category: EXERCISE_CATEGORIES.LOWER,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/glute_bridges_1779033395200.png',
    level: LEVEL.BEGINNER
  },
  {
    id: 'ex_lower_005',
    name: 'Wall Sit (Chaise)',
    category: EXERCISE_CATEGORIES.LOWER,
    goalType: GOAL_TYPES.TIME,
    mediaUrl: '/images/sport/wall_sit_1779051408501.png',
    level: LEVEL.INTERMEDIATE
  },

  // CARDIO
  {
    id: 'ex_cardio_001',
    name: 'Jumping Jacks',
    category: EXERCISE_CATEGORIES.CARDIO,
    goalType: GOAL_TYPES.TIME,
    mediaUrl: '/images/sport/jumping_jacks_1779051420569.png',
    level: LEVEL.BEGINNER
  },
  {
    id: 'ex_cardio_002',
    name: 'Burpees',
    category: EXERCISE_CATEGORIES.CARDIO,
    goalType: GOAL_TYPES.REPS,
    mediaUrl: '/images/sport/burpees_1779051433296.png',
    level: LEVEL.ADVANCED
  },
  {
    id: 'ex_cardio_003',
    name: 'Montées de genoux',
    category: EXERCISE_CATEGORIES.CARDIO,
    goalType: GOAL_TYPES.TIME,
    mediaUrl: '/images/sport/montees_genoux_1779051445465.png',
    level: LEVEL.INTERMEDIATE
  },
];
