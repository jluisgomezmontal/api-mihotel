import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Reservation from '../modules/reservations/reservation.model.js';
import Room from '../modules/rooms/room.model.js';

dotenv.config();

/**
 * Script to fix reservation pricing by removing duplicate IVA calculation
 * Room prices already include IVA, so we need to recalculate totalPrice without adding 16% tax
 */
async function fixReservationPricing() {
  try {
    console.log('🔧 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    console.log('📊 Fetching all active reservations...');
    const reservations = await Reservation.find({ 
      isActive: true,
      'pricing.taxes': { $gt: 0 } // Only fix reservations that have taxes > 0
    }).populate('roomId');

    console.log(`📋 Found ${reservations.length} reservations with taxes to fix`);

    let fixed = 0;
    let errors = 0;

    for (const reservation of reservations) {
      try {
        const oldTotalPrice = reservation.pricing.totalPrice;
        const oldTaxes = reservation.pricing.taxes;
        const oldRemainingBalance = reservation.paymentSummary.remainingBalance;

        // Recalculate pricing without taxes
        reservation.pricing.taxes = 0;
        reservation.pricing.totalPrice = reservation.pricing.subtotal + 
                                        reservation.pricing.fees.cleaning + 
                                        reservation.pricing.fees.service + 
                                        reservation.pricing.fees.extra;
        
        // Update payment summary
        reservation.paymentSummary.remainingBalance = 
          reservation.pricing.totalPrice - reservation.paymentSummary.totalPaid;

        await reservation.save();

        console.log(`✅ Fixed reservation ${reservation.confirmationNumber}:`);
        console.log(`   Old: Total=$${oldTotalPrice}, Taxes=$${oldTaxes}, Balance=$${oldRemainingBalance}`);
        console.log(`   New: Total=$${reservation.pricing.totalPrice}, Taxes=$${reservation.pricing.taxes}, Balance=$${reservation.paymentSummary.remainingBalance}`);
        
        fixed++;
      } catch (error) {
        console.error(`❌ Error fixing reservation ${reservation.confirmationNumber}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total processed: ${reservations.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

fixReservationPricing();
