// Canonical content contract. Only ReelReviewSubmissionSchema validates caller JSON.
// ServerResolvedReelReviewContext must come from authenticated canonical reads, never the body.
export {
  ReelReviewSubmissionSchema,
  ReelReviewBindingError,
  buildReelReviewPayload,
  fingerprintReelReviewPayload,
  type ReelReviewSubmission,
  type ServerResolvedReelReviewContext,
  type ReelReviewBindingErrorCode,
  type ReelReviewPayload,
} from '@letbuyy/cms-core';
