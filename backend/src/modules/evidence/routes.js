const express = require('express');

const router = express.Router();

router.post('/', async (req, res) => {
  res.status(201).json({
    id: 'stub-1',
    url: '/stub.png',
    fileName: 'stub.png'
  });
});

module.exports = router;
