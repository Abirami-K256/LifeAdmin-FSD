const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const authenticateToken = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// All document routes require authentication
router.use(authenticateToken);

// Upload & OCR process route
router.post('/process', upload.single('file'), documentController.processDocument);

// Confirm & save document
router.post('/', documentController.createDocument);

// Dashboard stats route
router.get('/stats', documentController.getDocumentStats);

// List all documents with search & filter
router.get('/', documentController.getDocuments);

// Single document operations
router.get('/:id', documentController.getDocumentById);
router.get('/:id/file', documentController.getDocumentFile);
router.put('/:id', documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
