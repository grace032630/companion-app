export type AnimalAnimationState = 'working' | 'idle' | 'pushed' | 'punched' | 'done';

export type ConstructionActionId = 'hammering' | 'carrying-wood' | 'painting' | 'carrying-box' | 'screwing';

export type CrewMember = {
  id: string;
  animal: string;
  name: string;
  action: ConstructionActionId;
  isMe: boolean;
};
