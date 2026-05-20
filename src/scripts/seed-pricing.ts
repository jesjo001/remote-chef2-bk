/**
 * Run this ONCE to initialize pricing configuration:
 * ts-node src/scripts/seed-pricing.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import PricingConfig from '../models/PricingConfig';

const seedPricing = async () => {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('Connected to DB...');

  const existing = await PricingConfig.findOne();
  if (existing) {
    console.log('Pricing configuration already exists.');
    console.log('To update, use the admin API: PUT /api/pricing/admin');
    process.exit(0);
  }

  await PricingConfig.create({
    // Selling prices (what users pay)
    mealPrice: 2000,           // ₦2,000 per meal
    deliveryFee: 1000,         // ₦1,000 per delivery
    processingFee: 10000,      // ₦10,000 monthly processing fee

    // Cost prices (for profit tracking)
    mealCostPrice: 1500,       // ₦1,500 cost to prepare meal
    deliveryCostPrice: 700,    // ₦700 delivery cost

    // Schedule options
    workdayCount: 20,          // 20 working days default
    allDayCount: 26,           // 26 days (exc. Sundays)

    // Portion options
    portionOptions: [
      { portions: 1, price: 2000, cost: 1500 },
      { portions: 2, price: 3500, cost: 2800 },
      { portions: 3, price: 4800, cost: 3800 },
    ],

    // Add-ons (e.g., drinks)
    addOns: [
      { name: 'Bottled water', price: 500, cost: 200 },
      { name: 'Soda (330ml)', price: 800, cost: 400 },
      { name: 'Yogurt', price: 600, cost: 300 },
    ],

    // Manual transfer disabled by default
    manualTransferEnabled: false,
    bankName: '',
    accountNumber: '',
    accountName: '',
  });

  console.log('✅ Pricing configuration initialized:');
  console.log('   Meal price: ₦2,000');
  console.log('   Delivery fee: ₦1,000');
  console.log('   Processing fee: ₦10,000');
  console.log('   Meal cost: ₦1,500');
  console.log('   Delivery cost: ₦700');
  console.log('');
  console.log('   Profit per meal: ₦500');
  console.log('   Profit per delivery: ₦300');
  console.log('');
  console.log('   Portion options: 1 (₦2,000), 2 (₦3,500), 3 (₦4,800)');
  console.log('   Add-ons: Bottled water (₦500), Soda (₦800), Yogurt (₦600)');
  console.log('');
  console.log('   Update pricing via: PUT /api/pricing/admin');
  process.exit(0);
};

seedPricing().catch(console.error);
