import { initDb } from './index.js';

const db = await initDb();
console.log('Database initialized. Run the server with: npm start');
