/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type FullyFormedURLToThePostExperimentSurvey = string;
export type ShortDescriptionOfTheExperiment = string;
export type GeneralUserInstructions = string;
/**
 * @minItems 1
 * @maxItems 4
 */
export type UserAgreements =
  | [IndividualizedUserAgreement]
  | [IndividualizedUserAgreement, IndividualizedUserAgreement]
  | [IndividualizedUserAgreement, IndividualizedUserAgreement, IndividualizedUserAgreement]
  | [
      IndividualizedUserAgreement,
      IndividualizedUserAgreement,
      IndividualizedUserAgreement,
      IndividualizedUserAgreement
    ];
export type IndividualizedUserAgreement = string;
export type GameEndScoreBy64 = number;
export type InteractionType = "swipe" | "tap" | "doubletap";
export type LongEffectHapticFile = string;
export type LongEffectAudioFile = string;
export type ShortEffectHapticFile = string;
export type ShortEffectAudioFile = string;
export type AdditionalInstructionImage = string;

export interface BasicExperimentSetup {
  survey_url: FullyFormedURLToThePostExperimentSurvey;
  experiment_description: ShortDescriptionOfTheExperiment;
  user_instructions: GeneralUserInstructions;
  user_agreements: UserAgreements;
  experiment_maxscore: GameEndScoreBy64;
  interaction_type: InteractionType;
  linked_files: ExperimentFiles;
  [k: string]: unknown;
}
export interface ExperimentFiles {
  long_effect: LongEffectHapticFile;
  long_audio: LongEffectAudioFile;
  short_effect: ShortEffectHapticFile;
  short_audio: ShortEffectAudioFile;
  instruction_image: AdditionalInstructionImage;
  [k: string]: unknown;
}