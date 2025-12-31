# Portfolio Website

## Overview

This project is a personal professional portfolio hosted using Node.js and GitHub Pages. It features an interactive CV with a search and filter system to browse projects by tags, programming languages, or topics.

## Features

- **Dynamic Project Display**: Projects are loaded dynamically from a JSON file.
- **Search and Filter**: Users can search and filter projects by various criteria.
- **Responsive Design**: The layout adjusts to different screen sizes.
- **High-Tech Theme**: Styled with a modern, high-tech look and feel.

## File Structure

- `server.js`: Node.js server to serve the website and API.
- `data/projects.json`: JSON file containing project data.
- `public/main.html`: Main HTML file for the portfolio.
- `public/styles.css`: CSS file for styling.
- `public/script.js`: JavaScript file for dynamic functionality.

## How to Run Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/your-repo.git
   ```
2. Navigate to the project directory:
   ```bash
   cd your-repo
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node server.js
   ```
5. Open your browser and go to `http://localhost:3000`.

## Hosting on GitHub Pages

The `main.html` file in the `public` directory is used as the entry point for GitHub Pages. Ensure the repository is set up to serve from the `public` directory.