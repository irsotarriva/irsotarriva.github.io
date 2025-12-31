/*!
 * @file server.js
 * @brief Node.js server for hosting the portfolio website.
 * @author Your Name
 * @email your.email@example.com
 * @date 2023-10-01
 * @copyright Copyright (c) 2023 for benefit of Your Collaboration.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public'), { index: 'home.html' }));
app.use(express.json());

// Endpoint to fetch projects data
app.get('/api/projects', (req, res) => {
    const projects = JSON.parse(fs.readFileSync('./data/projects.json', 'utf-8'));
    res.json(projects);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
