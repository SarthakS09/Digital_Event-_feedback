import { body, param, query, validationResult } from 'express-validator';

export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

export const feedbackSubmissionRules = [
  body('eventId').optional().isString().trim(),
  body('sessionId').optional().isString().trim(),
  body('eventName').optional().isString().trim().isLength({ max: 200 }),
  body('sessionName').optional().isString().trim().isLength({ max: 200 }),
  body('attendeeName').optional().isString().trim().isLength({ max: 100 }),
  body('attendeeEmail').optional().isEmail().normalizeEmail(),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('ratingVenue').optional().isInt({ min: 1, max: 5 }),
  body('ratingContent').optional().isInt({ min: 1, max: 5 }),
  body('ratingSpeakers').optional().isInt({ min: 1, max: 5 }),
  body('ratingOrganization').optional().isInt({ min: 1, max: 5 }),
  body('text').isString().trim().notEmpty().isLength({ min: 1, max: 10000 }),
  body('isAnonymous').optional().isBoolean(),
];

export const eventCreateRules = [
  body('name').isString().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().isString().trim(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('totalAttendees').optional().isInt({ min: 0 }),
];

export const sessionCreateRules = [
  body('eventId').isString().trim().notEmpty(),
  body('name').isString().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().isString().trim(),
  body('startTime').optional().isString(),
  body('endTime').optional().isString(),
  body('speakerName').optional().isString().trim(),
];

export const idParam = [param('id').isString().trim().notEmpty()];
export const eventIdParam = [param('eventId').isString().trim().notEmpty()];

export const analyticsQuery = [
  query('eventId').optional().isString().trim(),
  query('sessionId').optional().isString().trim(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
];
