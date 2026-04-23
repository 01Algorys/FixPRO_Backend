const express = require('express');
const { body } = require('express-validator');
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Validation rules
const sendMessageValidation = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters'),
  
  body('type')
    .optional()
    .isIn(['text', 'image', 'file'])
    .withMessage('Invalid message type')
];

// Routes
router.get('/', messageController.getConversations);
router.get('/worker/:workerId', messageController.getWorkerMessages);
router.get('/unread-count', messageController.getUnreadCount);
router.get('/:reservationId', messageController.getMessages);
router.post('/:reservationId', sendMessageValidation, messageController.sendMessage);
router.put('/:reservationId/read', messageController.markConversationAsRead);

module.exports = router;
