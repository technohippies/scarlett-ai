// Temporary fix file to track what needs to be fixed
// This file should be deleted after fixing all issues

const fixesNeeded = {
  "src/routes/karaoke.routes.ts": [
    "Remove unused imports: gradeAudioSchema"
  ],
  "src/routes/songs.routes.ts": [
    "Remove unused import: validateParams"
  ],
  "src/services/lyrics.service.ts": [
    "Remove unused import: LRCLibLyrics"
  ],
  "src/services/scoring.service.ts": [
    "Fix control character in regex: \\u0000 -> \\u0001"
  ],
  "src/services/session.service.ts": [
    "Remove unused import: ValidationError"
  ],
  "src/services/song.service.ts": [
    "Fix expression statement on line 182"
  ],
  "src/test/helpers/index.ts": [
    "Prefix unused params with underscore: query -> _query, params -> _params"
  ],
  "src/utils/errors.ts": [
    "Prefix unused param with underscore: statusCode -> _statusCode"
  ],
  "src/utils/validation.ts": [
    "Remove or export unused schemas: tutorAnalysisSchema, tutorTtsSchema"
  ]
};

// eslint-disable-next-line no-undef
module.exports = fixesNeeded;