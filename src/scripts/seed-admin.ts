/**
 * Run this ONCE to create your first superadmin:
 * ts-node src/scripts/seed-admin.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../models/Admin';

const seedAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('Connected to DB...');

  const existing = await Admin.findOne({ email: 'automationlounge@gmail.com' });
  if (existing) {
    console.log('Superadmin already exists.');
    process.exit(0);
  }

  await Admin.create({
    name: 'RemoteChef Admin',
    email: 'automationlounge@gmail.com',
    password: 'RemoteChef@2025!', // CHANGE THIS immediately after first login
    role: 'superadmin',
  });

  console.log('✅ Superadmin created:');
  console.log('   Email: automationlounge@gmail.com');
  console.log('   Password: RemoteChef@2025!');
  console.log('   ⚠️  CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN');
  process.exit(0);
};

seedAdmin().catch(console.error);
