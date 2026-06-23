export type CreatureId = 'weeper' | 'brancher' | 'hangman' | 'spindler' | 'witness';

export type GrowlType = 'whisper' | 'shriek' | 'choir' | 'click' | 'low';

export interface CreatureSpec {
  id: CreatureId;
  name: string;
  designation: string;
  height: number; // sprite height in world units
  speed: number; // chase speed (units/s)
  wanderSpeed: number;
  sight: number; // line-of-sight detection range (units)
  catchRadius: number;
  growl: GrowlType;
  floaty: boolean; // hovers instead of walking
  /** lab flavour shown as the subject mutates */
  labText: string;
}

export const CREATURES: Record<CreatureId, CreatureSpec> = {
  weeper: {
    id: 'weeper', name: 'THE WEEPER', designation: 'F6-01',
    height: 2.1, speed: 2.5, wanderSpeed: 1.0, sight: 11, catchRadius: 1.0, growl: 'whisper', floaty: false,
    labText: 'Subject weeps a dark fluid. Ocular cavities deepen. It will not stop smiling.',
  },
  brancher: {
    id: 'brancher', name: 'THE BRANCHER', designation: 'F6-02',
    height: 2.8, speed: 2.9, wanderSpeed: 1.0, sight: 12, catchRadius: 1.05, growl: 'shriek', floaty: false,
    labText: 'Limbs fork into pale branching structures. The jaw unhinges past the spine.',
  },
  hangman: {
    id: 'hangman', name: 'THE HANGMAN', designation: 'F6-03',
    height: 2.3, speed: 2.3, wanderSpeed: 0.8, sight: 14, catchRadius: 1.0, growl: 'choir', floaty: true,
    labText: 'Subject inverts. The mouth elongates downward, dripping. Eyes will not close.',
  },
  spindler: {
    id: 'spindler', name: 'THE SPINDLER', designation: 'F6-04',
    height: 2.9, speed: 3.6, wanderSpeed: 1.5, sight: 12, catchRadius: 1.1, growl: 'click', floaty: false,
    labText: 'Frame thins and lengthens. A conical skull splits. It moves in fast, broken steps.',
  },
  witness: {
    id: 'witness', name: 'THE WITNESS', designation: 'F6-05',
    height: 2.6, speed: 2.0, wanderSpeed: 0.9, sight: 18, catchRadius: 1.0, growl: 'choir', floaty: true,
    labText: 'A single radiant eye blooms from the skull. It always knows where you are looking.',
  },
};

export const ALL_IDS: CreatureId[] = ['weeper', 'brancher', 'hangman', 'spindler', 'witness'];
