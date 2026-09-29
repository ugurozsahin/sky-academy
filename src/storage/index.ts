// Persistent player state (localStorage). Small, versioned, safe on failure. Split by responsibility (#1415);
// every name that was exported from the single file is re-exported here, so no importer changes.
export { CERT_CAP, fileCert, DUEL_CAP, fileDuel } from './album-checks';
export { certificates, recordCert, duelHistory, recordDuel } from './albums';
export { exportSave, importSave } from './backup';
export { onboardedOf, MIGRATIONS, UNREADABLE_VERSION, saveVersionOf, isMigratable, isFutureSave, migrate } from './migrate';
export { NAME_MAX, cleanName } from './name';
export { type ProfileCard, profileCard, profileCards } from './profile-card';
export { PROFILE_IDS, type ProfileId, MAX_PROFILES, saveKeyFor, profileIds, activeProfile } from './profile-index';
export { type RenameProfileResult, type RenameRefusal, renameProfile, type DeleteProfileResult, type DeleteRefusal, deleteProfile } from './profile-manage';
export { type SetActiveResult, setActiveProfile, type AddProfileResult, addProfile } from './profile-switch';
export { recordTopic, recordAccuracy, recordTraining, recordEndless, recordSprint, recordBossWin, recordMemory, today, touchStreak } from './progress';
export { addCoins, dojoToday, recordDojo, type GameEndOutcome, recordGameEnd } from './rewards';
export { type AnswerTally, type TopicProgress, type StoredCert, type StoredDuel, type SaveData, SAVE_VERSION } from './shape';
export { isReadOnlySave, isWriteFailing } from './state';
export { STICKER_IDS, STICKER_COST, stickersFor, safeRecord, TOPICS_STARRED_GOAL, SPRINT_STICKER_SCORE, type Achievement, ACHIEVEMENTS, evaluateStickers } from './stickers';
export { load, save, reset } from './store';
export { wallet, coinBalance, buyItem, equipItem } from './wallet';
// 3-D: the grown-ups' setting (#714). Moved to device-settings.ts (#904) — parents.ts's other three settings
// (#905/#906/#907/#940) go there too, rather than growing this file's own #714 ratchet cap.
export { type ThreeSetting, THREE_SETTINGS, threeSetting, setThreeSetting } from '../device-settings';
