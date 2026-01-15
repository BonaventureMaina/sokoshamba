console.log('Script started');
import dotenv from 'dotenv';
console.log('Dotenv imported');

const result = dotenv.config();
console.log('Config result:', result);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('JWT_REFRESH_SECRET exists:', !!process.env.JWT_REFRESH_SECRET);
