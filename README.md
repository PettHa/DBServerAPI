# Neo4j Express API

This is a Node.js Express API that connects to a Neo4j Aura database.

## Running with Docker

### Prerequisites

- Docker
- Docker Compose
- Neo4j Aura database (already set up and running)

### Setting up Environment Variables

1. Create a `.env` file in the project root based on the provided `.env.example`:
   ```
   cp .env.example .env
   ```

2. Edit the `.env` file with your Neo4j Aura credentials:
   ```
   NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your-password
   PORT=3001
   ```

### Starting the API

1. Build and start the container:
   ```
   docker-compose up -d
   ```

2. Your API will be accessible at http://localhost:3001/api

3. To view logs:
   ```
   docker-compose logs -f
   ```

4. To stop the container:
   ```
   docker-compose down
   ```

## API Endpoints

- GET `/api/categories` - Get all category IDs
- GET `/api/cards` - Get all cards
- GET `/api/cards/:id` - Get a specific card
- POST `/api/admin/clear-cache` - Clear server cache

## Production Deployment

For production deployment, consider:

1. Using environment variables from a secure source instead of .env file
2. Setting up a reverse proxy like Nginx for HTTPS
3. Implementing proper authentication for your API