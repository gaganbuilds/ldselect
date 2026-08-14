import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });
console.log("Password is:", process.env.ADMIN_PASSWORD);
