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
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public'), { index: 'main.html' }));
app.use(express.json());

// Serve data files for browser fallbacks
app.use('/data', express.static(path.join(__dirname, 'data')));

// Endpoint to fetch projects data
app.get('/api/projects', (req, res) => {
    const projects = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'projects.json'), 'utf-8'));
    res.json(projects);
});

// Add endpoints for publications and presentations
app.get('/api/publications', (req, res) => {
    const pubs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'publications.json'), 'utf-8'));
    res.json(pubs);
});

app.get('/api/presentations', (req, res) => {
    const pres = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'presentations.json'), 'utf-8'));
    res.json(pres);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
